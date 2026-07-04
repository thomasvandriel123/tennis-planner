"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isOrganiser, isPlayer } from "@/lib/rbac";
import { redirect } from "@/i18n/navigation";
import {
  canOpenForPreferences,
  canPublish,
  canStartFinalPlanning,
  generateSessionDates,
  isPreferenceWindowOpen,
  parsePeriodForm,
  parsePreferenceForm,
  type PeriodFormError,
  type PeriodFormInput,
  type PreferenceFormError,
  type PreferenceFormInput,
} from "@/lib/periods";

// Server actions are reachable via direct POSTs, so every action re-checks
// the caller's session and role here - the UI hiding a button is not access
// control (see CLAUDE.md "Role checks belong server-side").

// The form states echo the submitted raw values back (and count submissions)
// because React resets a form's fields to their defaults after the action
// completes: the forms remount keyed on `submission` with `values` as the
// new defaults so nothing the user typed is lost.

export interface CreatePeriodState {
  errors: PeriodFormError[];
  values: PeriodFormInput | null;
  submission: number;
}

export async function createPeriod(
  prevState: CreatePeriodState,
  formData: FormData,
): Promise<CreatePeriodState> {
  const session = await auth();
  if (!isOrganiser(session)) throw new Error("Unauthorized");

  const input: PeriodFormInput = {
    name: String(formData.get("name") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    weekdays: formData.getAll("weekdays").map(String),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    preferenceDeadline: String(formData.get("preferenceDeadline") ?? ""),
    price: String(formData.get("price") ?? ""),
    trainerIds: formData.getAll("trainerIds").map(String),
  };
  const parsed = parsePeriodForm(input);
  if (!parsed.data) {
    return { errors: parsed.errors, values: input, submission: prevState.submission + 1 };
  }
  const { trainerIds, ...data } = parsed.data;

  // Only accept ids of members who actually hold the trainer role; a forged
  // POST could otherwise attach arbitrary users as proposed trainers.
  const trainerRoles = await db.userRole.findMany({
    where: { role: "TRAINER", userId: { in: trainerIds } },
    select: { userId: true },
  });
  const validTrainerIds = [...new Set(trainerRoles.map((r) => r.userId))];
  const trainerConnect = validTrainerIds.map((id) => ({ id }));

  // The proposed trainer roster applies to the whole recurring pattern for
  // now: every generated session gets the same trainers (SPECS.md §14.2
  // allows pattern-level assignment; per-session tweaks are a later step).
  const period = await db.trainingPeriod.create({
    data: {
      ...data,
      sessions: {
        create: generateSessionDates(data.startDate, data.endDate, data.weekdays).map((date) => ({
          date,
          startTime: data.startTime,
          endTime: data.endTime,
          trainers: { connect: trainerConnect },
        })),
      },
    },
    select: { id: true },
  });

  redirect({ href: `/periods/${period.id}`, locale: await getLocale() });
  return { errors: [], values: null, submission: 0 }; // unreachable; redirect() throws
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
  values: PreferenceFormInput | null;
  submission: number;
}

export async function submitPreference(
  prevState: SubmitPreferenceState,
  formData: FormData,
): Promise<SubmitPreferenceState> {
  const session = await auth();
  if (!session || !isPlayer(session)) throw new Error("Unauthorized");

  const periodId = String(formData.get("periodId") ?? "");
  const period = await db.trainingPeriod.findUnique({ where: { id: periodId } });
  if (!period || !isPreferenceWindowOpen(period, new Date())) {
    throw new Error("Preferences are closed for this period");
  }

  const input: PreferenceFormInput = {
    weekdays: formData.getAll("weekdays").map(String),
    skillLevel: String(formData.get("skillLevel") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = parsePreferenceForm(input, period.weekdays);
  const submission = prevState.submission + 1;
  if (!parsed.data) return { errors: parsed.errors, saved: false, values: input, submission };
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
  return { errors: [], saved: true, values: input, submission };
}
