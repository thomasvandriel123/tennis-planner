import type { PeriodStatus, Weekday } from "@/generated/prisma/enums";

// Pure domain logic for the training-period planning workflow (SPECS.md §4.1,
// §14): generating recurring session dates, parsing/validating the organiser's
// period form and a player's preference form, and the period status
// transitions. Kept free of Prisma/Next imports so it's unit-testable.

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
    if (wanted.has(JS_DAY_TO_WEEKDAY[day.getUTCDay()])) dates.push(day);
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

/** Parse a "YYYY-MM-DD" form value into a UTC-midnight Date, or null. */
export function parseDateOnly(input: string): Date | null {
  if (!DATE_RE.test(input)) return null;
  const date = new Date(`${input}T00:00:00Z`);
  // Rejects e.g. 2026-02-31, which Date would silently roll over to March.
  return date.toISOString().startsWith(input) ? date : null;
}

/** Raw string values from the new-period form (see actions.ts). */
export interface PeriodFormInput {
  name: string;
  startDate: string;
  endDate: string;
  weekdays: string[];
  startTime: string;
  endTime: string;
  preferenceDeadline: string;
  price: string;
  trainerIds: string[];
}

export interface ParsedPeriodForm {
  name: string;
  startDate: Date;
  endDate: Date;
  weekdays: Weekday[];
  startTime: string;
  endTime: string;
  preferenceDeadline: Date;
  priceCents: number;
  trainerIds: string[];
}

/** Error identifiers double as i18n keys under `periods.new.errors`. */
export type PeriodFormError =
  | "nameRequired"
  | "datesInvalid"
  | "datesOutOfOrder"
  | "weekdaysRequired"
  | "timesInvalid"
  | "timesOutOfOrder"
  | "deadlineInvalid"
  | "deadlineAfterEnd"
  | "priceInvalid";

export function parsePeriodForm(
  input: PeriodFormInput,
): { data: ParsedPeriodForm; errors: [] } | { data: null; errors: PeriodFormError[] } {
  const errors: PeriodFormError[] = [];

  const name = input.name.trim();
  if (!name) errors.push("nameRequired");

  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);
  if (!startDate || !endDate) errors.push("datesInvalid");
  else if (endDate < startDate) errors.push("datesOutOfOrder");

  const weekdays = input.weekdays.filter(isWeekday);
  if (weekdays.length === 0 || weekdays.length !== input.weekdays.length) {
    errors.push("weekdaysRequired");
  }

  if (!TIME_RE.test(input.startTime) || !TIME_RE.test(input.endTime)) {
    errors.push("timesInvalid");
  } else if (input.endTime <= input.startTime) {
    errors.push("timesOutOfOrder");
  }

  const preferenceDeadline = new Date(input.preferenceDeadline);
  if (!input.preferenceDeadline || Number.isNaN(preferenceDeadline.getTime())) {
    errors.push("deadlineInvalid");
  } else if (endDate && preferenceDeadline.getTime() >= endDate.getTime() + 24 * 60 * 60 * 1000) {
    // A deadline after the period has fully ended can never be acted on.
    errors.push("deadlineAfterEnd");
  }

  const priceCents = parseEurosToCents(input.price);
  if (priceCents === null) errors.push("priceInvalid");

  if (errors.length > 0) return { data: null, errors };
  return {
    data: {
      name,
      startDate: startDate!,
      endDate: endDate!,
      weekdays: [...WEEKDAYS].filter((d) => weekdays.includes(d)),
      startTime: input.startTime,
      endTime: input.endTime,
      preferenceDeadline,
      priceCents: priceCents!,
      trainerIds: [...new Set(input.trainerIds)],
    },
    errors: [],
  };
}

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
      preferredWeekdays: [...WEEKDAYS].filter((d) => weekdays.includes(d)),
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
