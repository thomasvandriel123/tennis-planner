"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isOrganiser, isPlayer } from "@/lib/rbac";
import { redirect } from "@/i18n/navigation";
import {
  buildGeneratedSessions,
  canOpenForPreferences,
  canPublish,
  canStartFinalPlanning,
  isPreferenceWindowOpen,
  parsePeriodForm,
  parsePreferenceForm,
  weekdayOf,
  type PeriodFormError,
  type RecurringSlotInput,
  type PreferenceFormError,
} from "@/lib/periods";
import type { Weekday } from "@/generated/prisma/enums";

// Server actions are reachable via direct POSTs, so every action re-checks
// the caller's session and role here - the UI hiding a button is not access
// control (see CLAUDE.md "Role checks belong server-side").
//
// The forms are fully client-controlled, so nothing typed is lost when the
// action returns; these states only carry validation errors (and a saved flag).

export interface CreatePeriodState {
  errors: PeriodFormError[];
}

/** Read the parallel slot-row arrays the form posts into an ordered list. */
function readSlotRows(formData: FormData): RecurringSlotInput[] {
  const weekdays = formData.getAll("slotWeekday").map(String);
  const startTimes = formData.getAll("slotStartTime").map(String);
  const capacities = formData.getAll("slotCapacity").map(String);
  const labels = formData.getAll("slotLabel").map(String);
  const trainerIds = formData.getAll("slotTrainerId").map(String);
  return weekdays.map((weekday, i) => ({
    weekday,
    startTime: startTimes[i] ?? "",
    capacity: capacities[i] ?? "",
    label: labels[i] ?? "",
    trainerId: trainerIds[i] ?? "",
  }));
}

export async function createPeriod(
  _prevState: CreatePeriodState,
  formData: FormData,
): Promise<CreatePeriodState> {
  const session = await auth();
  if (!isOrganiser(session)) throw new Error("Unauthorized");

  const parsed = parsePeriodForm({
    name: String(formData.get("name") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    durationMinutes: String(formData.get("durationMinutes") ?? ""),
    slots: readSlotRows(formData),
    preferenceDeadline: String(formData.get("preferenceDeadline") ?? ""),
    price: String(formData.get("price") ?? ""),
  });
  if (!parsed.data) return { errors: parsed.errors };
  // `weekdays` is derived (validation only); `durationMinutes` maps to the
  // differently-named column. Neither can be spread straight into `data`.
  const { slots, weekdays: _weekdays, durationMinutes, ...data } = parsed.data;
  void _weekdays;

  // Only accept trainer ids of members who actually hold the trainer role; a
  // forged POST could otherwise attach arbitrary users as proposed trainers.
  const wantedTrainerIds = [...new Set(slots.map((s) => s.trainerId).filter((id): id is string => !!id))];
  const trainerRoles = await db.userRole.findMany({
    where: { role: "TRAINER", userId: { in: wantedTrainerIds } },
    select: { userId: true },
  });
  const validTrainerIds = new Set(trainerRoles.map((r) => r.userId));
  const cleanSlots = slots.map((slot) => ({
    ...slot,
    trainerId: slot.trainerId && validTrainerIds.has(slot.trainerId) ? slot.trainerId : null,
  }));

  // Generated sessions span each day's blocks; connect that day's block
  // trainers to the session so the concrete roster is available later.
  const trainersByWeekday = new Map<Weekday, Set<string>>();
  for (const slot of cleanSlots) {
    if (!slot.trainerId) continue;
    const set = trainersByWeekday.get(slot.weekday) ?? new Set<string>();
    set.add(slot.trainerId);
    trainersByWeekday.set(slot.weekday, set);
  }

  const period = await db.trainingPeriod.create({
    data: {
      ...data,
      sessionDurationMinutes: durationMinutes,
      recurringSlots: {
        create: cleanSlots.map(({ weekday, startTime, endTime, capacity, label, trainerId }) => ({
          weekday,
          startTime,
          endTime,
          capacity,
          label,
          trainerId,
        })),
      },
      sessions: {
        create: buildGeneratedSessions(data.startDate, data.endDate, cleanSlots).map((s) => ({
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          trainers: {
            connect: [...(trainersByWeekday.get(weekdayOf(s.date)) ?? [])].map((id) => ({ id })),
          },
        })),
      },
    },
    select: { id: true },
  });

  redirect({ href: `/periods/${period.id}`, locale: await getLocale() });
  return { errors: [] }; // unreachable; redirect() throws
}

async function requireOrganiserAndPeriod(formData: FormData) {
  const session = await auth();
  if (!isOrganiser(session)) throw new Error("Unauthorized");
  const periodId = String(formData.get("periodId") ?? "");
  const period = await db.trainingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new Error("Period not found");
  return period;
}

function revalidatePeriodPages() {
  // Both locales render from the same dynamic routes.
  revalidatePath("/[locale]/periods", "page");
  revalidatePath("/[locale]/periods/[id]", "page");
}

/** DRAFT -> OPEN: make the period visible to players for preferences. */
export async function openPeriodForPreferences(formData: FormData): Promise<void> {
  const period = await requireOrganiserAndPeriod(formData);
  if (!canOpenForPreferences(period.status)) throw new Error("Invalid status transition");
  await db.trainingPeriod.update({ where: { id: period.id }, data: { status: "OPEN" } });
  revalidatePeriodPages();
}

/** OPEN -> ASSIGNING: lock the period for final planning after the deadline. */
export async function startFinalPlanning(formData: FormData): Promise<void> {
  const period = await requireOrganiserAndPeriod(formData);
  if (!canStartFinalPlanning(period, new Date())) throw new Error("Invalid status transition");
  await db.trainingPeriod.update({ where: { id: period.id }, data: { status: "ASSIGNING" } });
  revalidatePeriodPages();
}

/** ASSIGNING -> PUBLISHED: publish the final plan to players. */
export async function publishPeriod(formData: FormData): Promise<void> {
  const period = await requireOrganiserAndPeriod(formData);
  if (!canPublish(period.status)) throw new Error("Invalid status transition");
  await db.trainingPeriod.update({ where: { id: period.id }, data: { status: "PUBLISHED" } });
  revalidatePeriodPages();
}

export interface SubmitPreferenceState {
  errors: PreferenceFormError[];
  saved: boolean;
}

export async function submitPreference(
  _prevState: SubmitPreferenceState,
  formData: FormData,
): Promise<SubmitPreferenceState> {
  const session = await auth();
  if (!session || !isPlayer(session)) throw new Error("Unauthorized");

  const periodId = String(formData.get("periodId") ?? "");
  const period = await db.trainingPeriod.findUnique({
    where: { id: periodId },
    include: { recurringSlots: { select: { weekday: true } } },
  });
  if (!period || !isPreferenceWindowOpen(period, new Date())) {
    throw new Error("Preferences are closed for this period");
  }
  const offeredWeekdays = [...new Set(period.recurringSlots.map((s) => s.weekday))];

  const parsed = parsePreferenceForm(
    {
      weekdays: formData.getAll("weekdays").map(String),
      skillLevel: String(formData.get("skillLevel") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    },
    offeredWeekdays,
  );
  if (!parsed.data) return { errors: parsed.errors, saved: false };
  const { preferredWeekdays, skillLevel, notes } = parsed.data;

  const userId = session.user.id;
  await db.$transaction([
    db.preference.upsert({
      where: { userId_periodId: { userId, periodId } },
      create: { userId, periodId, preferredWeekdays, skillLevel, notes },
      update: { preferredWeekdays, skillLevel, notes },
    }),
    // The schema documents Preference.skillLevel as copied onto the User.
    db.user.update({ where: { id: userId }, data: { skillLevel } }),
  ]);

  revalidatePeriodPages();
  return { errors: [], saved: true };
}
