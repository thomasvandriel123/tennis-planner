import type { PeriodStatus, Weekday } from "@/generated/prisma/enums";

// Pure domain logic for the training-period planning workflow (SPECS.md §4.1,
// §14): the weekly recurring-slot schedule, generating the concrete session
// dates from it, parsing/validating the organiser's period form and a player's
// preference form, and the period status transitions. Kept free of
// Prisma/Next imports so it's unit-testable.

/** All weekdays in calendar order (Monday-first, as shown to members). */
export const WEEKDAYS: readonly Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

// Index matches Date.prototype.getUTCDay() (0 = Sunday).
const JS_DAY_TO_WEEKDAY: readonly Weekday[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export function isWeekday(value: string): value is Weekday {
  return (WEEKDAYS as readonly string[]).includes(value);
}

/** The Weekday a given (UTC) date falls on. */
export function weekdayOf(date: Date): Weekday {
  return JS_DAY_TO_WEEKDAY[date.getUTCDay()];
}

/** Sort weekdays into calendar order (Monday first). */
export function sortWeekdays(weekdays: readonly Weekday[]): Weekday[] {
  return WEEKDAYS.filter((d) => weekdays.includes(d));
}

/**
 * Every date between startDate and endDate (inclusive) that falls on one of
 * the given weekdays, in ascending order. Dates are UTC midnights, matching
 * how TrainingPeriod.startDate/endDate and TrainingSession.date are stored.
 */
export function generateSessionDates(
  startDate: Date,
  endDate: Date,
  weekdays: readonly Weekday[],
): Date[] {
  const wanted = new Set(weekdays);
  const dates: Date[] = [];
  for (
    let t = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
    t <= endDate.getTime();
    t += 24 * 60 * 60 * 1000
  ) {
    const day = new Date(t);
    if (wanted.has(weekdayOf(day))) dates.push(day);
  }
  return dates;
}

/**
 * Parse a euro amount as typed by the organiser ("300", "12.50", "12,50" -
 * Dutch users use a comma) into integer cents. Returns null when the input
 * isn't a plain positive amount with at most two decimals.
 */
export function parseEurosToCents(input: string): number | null {
  const match = /^\s*(\d+)(?:[.,](\d{1,2}))?\s*$/.exec(input);
  if (!match) return null;
  const euros = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const total = euros * 100 + cents;
  return total > 0 ? total : null;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Minutes since midnight for a "HH:mm" string, or null if malformed. */
export function parseTimeToMinutes(input: string): number | null {
  if (!TIME_RE.test(input)) return null;
  const [h, m] = input.split(":").map(Number);
  return h * 60 + m;
}

/** Format minutes-since-midnight back to "HH:mm" (e.g. 1140 -> "19:00"). */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Session lengths offered in the new-period form, in minutes. */
export const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120] as const;
export const DEFAULT_DURATION_MINUTES = 60;

/** Parse a "YYYY-MM-DD" form value into a UTC-midnight Date, or null. */
export function parseDateOnly(input: string): Date | null {
  if (!DATE_RE.test(input)) return null;
  const date = new Date(`${input}T00:00:00Z`);
  // Rejects e.g. 2026-02-31, which Date would silently roll over to March.
  return date.toISOString().startsWith(input) ? date : null;
}

// --- Recurring weekly schedule ---------------------------------------------

/**
 * Raw string values for one weekly training block (see the new-period form).
 * A block has only a start time; its end is derived from the period's session
 * duration, so different days can run at different times just by picking
 * different starts, and two blocks can share a start (parallel trainings).
 */
export interface RecurringSlotInput {
  weekday: string;
  startTime: string;
  capacity: string;
  label: string;
  trainerId: string;
}

export interface ParsedRecurringSlot {
  weekday: Weekday;
  startTime: string;
  endTime: string;
  capacity: number;
  label: string | null;
  trainerId: string | null;
}

/** True for a slot row the organiser left completely blank (ignored on save). */
function isBlankSlot(slot: RecurringSlotInput): boolean {
  return (
    !slot.weekday.trim() &&
    !slot.startTime.trim() &&
    !slot.capacity.trim() &&
    !slot.label.trim() &&
    !slot.trainerId.trim()
  );
}

/**
 * The earliest start and latest end among the slots on each weekday. Used to
 * span the generated TrainingSession over that day's blocks. "HH:mm" strings
 * compare correctly as plain strings.
 */
export function sessionSpans(
  slots: readonly ParsedRecurringSlot[],
): Partial<Record<Weekday, { startTime: string; endTime: string }>> {
  const spans: Partial<Record<Weekday, { startTime: string; endTime: string }>> = {};
  for (const slot of slots) {
    const current = spans[slot.weekday];
    if (!current) {
      spans[slot.weekday] = { startTime: slot.startTime, endTime: slot.endTime };
    } else {
      if (slot.startTime < current.startTime) current.startTime = slot.startTime;
      if (slot.endTime > current.endTime) current.endTime = slot.endTime;
    }
  }
  return spans;
}

/**
 * The concrete TrainingSessions to generate: one per calendar date matching a
 * slot's weekday, spanning that day's blocks. Ascending by date.
 */
export function buildGeneratedSessions(
  startDate: Date,
  endDate: Date,
  slots: readonly ParsedRecurringSlot[],
): { date: Date; startTime: string; endTime: string }[] {
  const spans = sessionSpans(slots);
  const weekdays = Object.keys(spans) as Weekday[];
  return generateSessionDates(startDate, endDate, weekdays).map((date) => {
    const span = spans[weekdayOf(date)]!;
    return { date, startTime: span.startTime, endTime: span.endTime };
  });
}

// --- Period form ------------------------------------------------------------

/** Raw string values from the new-period form (see actions.ts). */
export interface PeriodFormInput {
  name: string;
  startDate: string;
  endDate: string;
  durationMinutes: string;
  slots: RecurringSlotInput[];
  preferenceDeadline: string;
  price: string;
}

export interface ParsedPeriodForm {
  name: string;
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
  slots: ParsedRecurringSlot[];
  /** Distinct weekdays across the slots, in calendar order. */
  weekdays: Weekday[];
  preferenceDeadline: Date;
  priceCents: number;
}

/** Error identifiers double as i18n keys under `periods.new.errors`. */
export type PeriodFormError =
  | "nameRequired"
  | "datesInvalid"
  | "datesOutOfOrder"
  | "durationInvalid"
  | "slotsRequired"
  | "slotWeekdayInvalid"
  | "slotTimesInvalid"
  | "slotEndsPastMidnight"
  | "slotCapacityInvalid"
  | "deadlineInvalid"
  | "deadlineAfterFirstTraining"
  | "priceInvalid";

/**
 * The naive local Date of a generated session's start (its date at its start
 * time). Used to check the preference deadline falls before the first
 * training. Session dates are UTC midnights; combining with the local "HH:mm"
 * start keeps this consistent with `new Date(deadlineInput)`, which is also
 * parsed in local time.
 */
function sessionStartDate(session: { date: Date; startTime: string }): Date {
  return new Date(`${session.date.toISOString().slice(0, 10)}T${session.startTime}:00`);
}

export function parsePeriodForm(
  input: PeriodFormInput,
): { data: ParsedPeriodForm; errors: [] } | { data: null; errors: PeriodFormError[] } {
  const errors = new Set<PeriodFormError>();

  const name = input.name.trim();
  if (!name) errors.add("nameRequired");

  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);
  if (!startDate || !endDate) errors.add("datesInvalid");
  else if (endDate < startDate) errors.add("datesOutOfOrder");

  const durationMinutes = Number(input.durationMinutes);
  const durationValid = Number.isInteger(durationMinutes) && durationMinutes > 0;
  if (!durationValid) errors.add("durationInvalid");

  const rows = input.slots.filter((slot) => !isBlankSlot(slot));
  const slots: ParsedRecurringSlot[] = [];
  if (rows.length === 0) {
    errors.add("slotsRequired");
  } else {
    for (const row of rows) {
      if (!isWeekday(row.weekday)) errors.add("slotWeekdayInvalid");
      const startMinutes = parseTimeToMinutes(row.startTime);
      if (startMinutes === null) errors.add("slotTimesInvalid");
      const endMinutes = startMinutes !== null && durationValid ? startMinutes + durationMinutes : null;
      // A training may not run past midnight.
      if (endMinutes !== null && endMinutes > 24 * 60) errors.add("slotEndsPastMidnight");
      const capacity = Number(row.capacity);
      if (!Number.isInteger(capacity) || capacity < 1) errors.add("slotCapacityInvalid");
      if (
        isWeekday(row.weekday) &&
        startMinutes !== null &&
        endMinutes !== null &&
        endMinutes <= 24 * 60 &&
        capacity >= 1
      ) {
        slots.push({
          weekday: row.weekday,
          startTime: row.startTime,
          endTime: minutesToTime(endMinutes),
          capacity,
          label: row.label.trim() ? row.label.trim().slice(0, 60) : null,
          trainerId: row.trainerId.trim() || null,
        });
      }
    }
  }

  const preferenceDeadline = new Date(input.preferenceDeadline);
  const deadlineValid = Boolean(input.preferenceDeadline) && !Number.isNaN(preferenceDeadline.getTime());
  if (!deadlineValid) {
    errors.add("deadlineInvalid");
  } else if (startDate && endDate && slots.length > 0) {
    const firstSession = buildGeneratedSessions(startDate, endDate, slots)[0];
    // The deadline must fall strictly before the first training.
    if (firstSession && preferenceDeadline.getTime() >= sessionStartDate(firstSession).getTime()) {
      errors.add("deadlineAfterFirstTraining");
    }
  }

  const priceCents = parseEurosToCents(input.price);
  if (priceCents === null) errors.add("priceInvalid");

  if (errors.size > 0) return { data: null, errors: [...errors] };
  return {
    data: {
      name,
      startDate: startDate!,
      endDate: endDate!,
      durationMinutes,
      slots,
      weekdays: sortWeekdays([...new Set(slots.map((s) => s.weekday))]),
      preferenceDeadline,
      priceCents: priceCents!,
    },
    errors: [],
  };
}

// --- Preference form --------------------------------------------------------

/** Raw string values from a player's preference form. */
export interface PreferenceFormInput {
  weekdays: string[];
  skillLevel: string;
  notes: string;
}

export interface ParsedPreferenceForm {
  preferredWeekdays: Weekday[];
  skillLevel: number;
  notes: string | null;
}

/** Error identifiers double as i18n keys under `periods.preferenceForm.errors`. */
export type PreferenceFormError = "weekdaysRequired" | "weekdaysNotOffered" | "skillLevelInvalid";

export function parsePreferenceForm(
  input: PreferenceFormInput,
  periodWeekdays: readonly Weekday[],
): { data: ParsedPreferenceForm; errors: [] } | { data: null; errors: PreferenceFormError[] } {
  const errors: PreferenceFormError[] = [];

  const weekdays = input.weekdays.filter(isWeekday);
  if (weekdays.length === 0 || weekdays.length !== input.weekdays.length) {
    errors.push("weekdaysRequired");
  } else if (weekdays.some((d) => !periodWeekdays.includes(d))) {
    errors.push("weekdaysNotOffered");
  }

  const skillLevel = Number(input.skillLevel);
  if (!Number.isInteger(skillLevel) || skillLevel < 1 || skillLevel > 9) {
    errors.push("skillLevelInvalid");
  }

  if (errors.length > 0) return { data: null, errors };
  const notes = input.notes.trim();
  return {
    data: {
      preferredWeekdays: sortWeekdays(weekdays),
      skillLevel,
      notes: notes ? notes.slice(0, 2000) : null,
    },
    errors: [],
  };
}

// --- Status transitions (PeriodStatus lifecycle, see schema.prisma) ---------

/** DRAFT -> OPEN: organiser makes the period visible for preferences. */
export function canOpenForPreferences(status: PeriodStatus): boolean {
  return status === "DRAFT";
}

/**
 * OPEN -> ASSIGNING: organiser locks the period for final planning. Only
 * allowed once the preference deadline has passed (SPECS.md §14.2).
 */
export function canStartFinalPlanning(
  period: { status: PeriodStatus; preferenceDeadline: Date },
  now: Date,
): boolean {
  return period.status === "OPEN" && now >= period.preferenceDeadline;
}

/** ASSIGNING -> PUBLISHED: organiser publishes the final plan. */
export function canPublish(status: PeriodStatus): boolean {
  return status === "ASSIGNING";
}

/** Whether a player can currently submit or edit their preference. */
export function isPreferenceWindowOpen(
  period: { status: PeriodStatus; preferenceDeadline: Date },
  now: Date,
): boolean {
  return period.status === "OPEN" && now < period.preferenceDeadline;
}
