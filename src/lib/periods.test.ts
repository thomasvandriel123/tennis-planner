import { describe, expect, it } from "vitest";
import {
  buildGeneratedSessions,
  canOpenForPreferences,
  canPublish,
  canStartFinalPlanning,
  generateSessionDates,
  isPreferenceWindowOpen,
  parseDateOnly,
  parseEurosToCents,
  parsePeriodForm,
  parsePreferenceForm,
  sessionSpans,
  weekdayOf,
  type PeriodFormInput,
  type ParsedRecurringSlot,
  type RecurringSlotInput,
} from "./periods";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("weekdayOf", () => {
  it("maps UTC dates to weekdays", () => {
    expect(weekdayOf(utc("2027-01-04"))).toBe("MONDAY");
    expect(weekdayOf(utc("2027-01-10"))).toBe("SUNDAY");
  });
});

describe("generateSessionDates", () => {
  it("generates one date per matching weekday in the range", () => {
    // 2027-01-04 is a Monday; two full weeks.
    const dates = generateSessionDates(utc("2027-01-04"), utc("2027-01-17"), [
      "MONDAY",
      "TUESDAY",
    ]);
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2027-01-04",
      "2027-01-05",
      "2027-01-11",
      "2027-01-12",
    ]);
  });

  it("includes both range endpoints when they match", () => {
    const dates = generateSessionDates(utc("2027-01-04"), utc("2027-01-11"), ["MONDAY"]);
    expect(dates).toHaveLength(2);
  });

  it("returns an empty list when no weekday falls in the range", () => {
    // 2027-01-05 (Tue) to 2027-01-08 (Fri) contains no Monday.
    expect(generateSessionDates(utc("2027-01-05"), utc("2027-01-08"), ["MONDAY"])).toEqual([]);
  });

  it("handles a single-day range", () => {
    expect(generateSessionDates(utc("2027-01-04"), utc("2027-01-04"), ["MONDAY"])).toHaveLength(1);
    expect(generateSessionDates(utc("2027-01-04"), utc("2027-01-04"), ["TUESDAY"])).toEqual([]);
  });

  it("crosses month and DST boundaries without skipping days", () => {
    // Late March covers the European DST switch (2027-03-28).
    const dates = generateSessionDates(utc("2027-03-22"), utc("2027-04-05"), ["MONDAY"]);
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2027-03-22",
      "2027-03-29",
      "2027-04-05",
    ]);
  });
});

describe("sessionSpans / buildGeneratedSessions", () => {
  const slots: ParsedRecurringSlot[] = [
    { weekday: "MONDAY", startTime: "18:00", endTime: "19:00", capacity: 4, label: "Group 1" },
    { weekday: "MONDAY", startTime: "19:00", endTime: "20:00", capacity: 1, label: "Private" },
    { weekday: "MONDAY", startTime: "20:00", endTime: "21:00", capacity: 2, label: "Group 2" },
    { weekday: "WEDNESDAY", startTime: "10:00", endTime: "11:00", capacity: 4, label: null },
  ];

  it("spans each weekday from its earliest start to its latest end", () => {
    expect(sessionSpans(slots)).toEqual({
      MONDAY: { startTime: "18:00", endTime: "21:00" },
      WEDNESDAY: { startTime: "10:00", endTime: "11:00" },
    });
  });

  it("generates one session per matching date, spanning that day's blocks", () => {
    // 2027-01-04 Mon, 2027-01-06 Wed, 2027-01-11 Mon.
    const sessions = buildGeneratedSessions(utc("2027-01-04"), utc("2027-01-11"), slots);
    expect(
      sessions.map((s) => [s.date.toISOString().slice(0, 10), s.startTime, s.endTime]),
    ).toEqual([
      ["2027-01-04", "18:00", "21:00"],
      ["2027-01-06", "10:00", "11:00"],
      ["2027-01-11", "18:00", "21:00"],
    ]);
  });
});

describe("parseEurosToCents", () => {
  it("parses whole euro amounts", () => {
    expect(parseEurosToCents("300")).toBe(30000);
  });

  it("parses decimal amounts with a dot or a comma", () => {
    expect(parseEurosToCents("12.50")).toBe(1250);
    expect(parseEurosToCents("12,50")).toBe(1250);
    expect(parseEurosToCents("12,5")).toBe(1250);
  });

  it("rejects zero, negatives and malformed input", () => {
    expect(parseEurosToCents("0")).toBeNull();
    expect(parseEurosToCents("-5")).toBeNull();
    expect(parseEurosToCents("12.345")).toBeNull();
    expect(parseEurosToCents("abc")).toBeNull();
    expect(parseEurosToCents("")).toBeNull();
  });
});

describe("parseDateOnly", () => {
  it("parses a valid date as UTC midnight", () => {
    expect(parseDateOnly("2027-01-04")?.toISOString()).toBe("2027-01-04T00:00:00.000Z");
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseDateOnly("04-01-2027")).toBeNull();
    expect(parseDateOnly("2027-02-31")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });
});

const slot = (over: Partial<RecurringSlotInput> = {}): RecurringSlotInput => ({
  weekday: "MONDAY",
  startTime: "18:00",
  endTime: "19:00",
  capacity: "4",
  label: "Group 1",
  ...over,
});

const validPeriodInput: PeriodFormInput = {
  name: "Spring 2027",
  startDate: "2027-01-04",
  endDate: "2027-03-29",
  slots: [
    slot(),
    slot({ startTime: "19:00", endTime: "20:00", capacity: "1", label: "Private" }),
    slot({ weekday: "TUESDAY", startTime: "20:00", endTime: "21:00", capacity: "2", label: "" }),
  ],
  preferenceDeadline: "2026-12-20T23:59",
  price: "300",
  trainerIds: ["trainer_1", "trainer_1", "trainer_2"],
};

describe("parsePeriodForm", () => {
  it("accepts a complete valid form", () => {
    const result = parsePeriodForm(validPeriodInput);
    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({ name: "Spring 2027", priceCents: 30000 });
    // Weekdays derived from the slots, in calendar order; trainers de-duped.
    expect(result.data?.weekdays).toEqual(["MONDAY", "TUESDAY"]);
    expect(result.data?.trainerIds).toEqual(["trainer_1", "trainer_2"]);
    expect(result.data?.slots).toHaveLength(3);
    // Empty label becomes null; capacity parsed to a number.
    expect(result.data?.slots[2]).toEqual({
      weekday: "TUESDAY",
      startTime: "20:00",
      endTime: "21:00",
      capacity: 2,
      label: null,
    });
  });

  it("ignores completely blank slot rows", () => {
    const result = parsePeriodForm({
      ...validPeriodInput,
      slots: [slot(), { weekday: "", startTime: "", endTime: "", capacity: "", label: "" }],
    });
    expect(result.errors).toEqual([]);
    expect(result.data?.slots).toHaveLength(1);
  });

  it.each([
    [{ name: "  " }, "nameRequired"],
    [{ startDate: "not-a-date" }, "datesInvalid"],
    [{ endDate: "2026-12-01" }, "datesOutOfOrder"],
    [{ preferenceDeadline: "" }, "deadlineInvalid"],
    [{ preferenceDeadline: "2027-06-01T12:00" }, "deadlineAfterEnd"],
    [{ price: "gratis" }, "priceInvalid"],
  ] as const)("rejects %o with %s", (override, expectedError) => {
    const result = parsePeriodForm({ ...validPeriodInput, ...override });
    expect(result.data).toBeNull();
    expect(result.errors).toContain(expectedError);
  });

  it("requires at least one non-blank slot", () => {
    const result = parsePeriodForm({ ...validPeriodInput, slots: [] });
    expect(result.errors).toContain("slotsRequired");
  });

  it.each([
    [{ weekday: "FUNDAY" }, "slotWeekdayInvalid"],
    [{ startTime: "25:00" }, "slotTimesInvalid"],
    [{ startTime: "19:00", endTime: "18:00" }, "slotTimesOutOfOrder"],
    [{ capacity: "0" }, "slotCapacityInvalid"],
    [{ capacity: "2.5" }, "slotCapacityInvalid"],
  ] as const)("rejects a slot with %o as %s", (override, expectedError) => {
    const result = parsePeriodForm({ ...validPeriodInput, slots: [slot(override)] });
    expect(result.data).toBeNull();
    expect(result.errors).toContain(expectedError);
  });

  it("allows a deadline on the period's last day", () => {
    const result = parsePeriodForm({
      ...validPeriodInput,
      preferenceDeadline: "2027-03-29T12:00",
    });
    expect(result.errors).toEqual([]);
  });

  it("collects multiple errors at once", () => {
    const result = parsePeriodForm({
      ...validPeriodInput,
      name: "",
      price: "",
      slots: [],
    });
    expect(result.errors).toEqual(
      expect.arrayContaining(["nameRequired", "priceInvalid", "slotsRequired"]),
    );
  });
});

describe("parsePreferenceForm", () => {
  const periodWeekdays = ["MONDAY", "TUESDAY"] as const;

  it("accepts weekdays offered by the period", () => {
    const result = parsePreferenceForm(
      { weekdays: ["TUESDAY", "MONDAY"], skillLevel: "5", notes: "  after 19:00 please  " },
      periodWeekdays,
    );
    expect(result.errors).toEqual([]);
    expect(result.data).toEqual({
      preferredWeekdays: ["MONDAY", "TUESDAY"],
      skillLevel: 5,
      notes: "after 19:00 please",
    });
  });

  it("stores empty notes as null", () => {
    const result = parsePreferenceForm(
      { weekdays: ["MONDAY"], skillLevel: "1", notes: "   " },
      periodWeekdays,
    );
    expect(result.data?.notes).toBeNull();
  });

  it("rejects weekdays the period doesn't train on", () => {
    const result = parsePreferenceForm(
      { weekdays: ["FRIDAY"], skillLevel: "5", notes: "" },
      periodWeekdays,
    );
    expect(result.errors).toContain("weekdaysNotOffered");
  });

  it("requires at least one weekday", () => {
    const result = parsePreferenceForm({ weekdays: [], skillLevel: "5", notes: "" }, periodWeekdays);
    expect(result.errors).toContain("weekdaysRequired");
  });

  it.each(["0", "10", "4.5", "", "great"])("rejects skill level %s", (skillLevel) => {
    const result = parsePreferenceForm(
      { weekdays: ["MONDAY"], skillLevel, notes: "" },
      periodWeekdays,
    );
    expect(result.errors).toContain("skillLevelInvalid");
  });
});

describe("status transitions", () => {
  const deadline = utc("2027-01-01");
  const before = new Date(deadline.getTime() - 1000);
  const after = new Date(deadline.getTime() + 1000);

  it("only a draft period can be opened", () => {
    expect(canOpenForPreferences("DRAFT")).toBe(true);
    expect(canOpenForPreferences("OPEN")).toBe(false);
    expect(canOpenForPreferences("PUBLISHED")).toBe(false);
  });

  it("final planning requires OPEN status and a passed deadline", () => {
    expect(canStartFinalPlanning({ status: "OPEN", preferenceDeadline: deadline }, after)).toBe(true);
    expect(canStartFinalPlanning({ status: "OPEN", preferenceDeadline: deadline }, before)).toBe(false);
    expect(canStartFinalPlanning({ status: "DRAFT", preferenceDeadline: deadline }, after)).toBe(false);
  });

  it("only an ASSIGNING period can be published", () => {
    expect(canPublish("ASSIGNING")).toBe(true);
    expect(canPublish("OPEN")).toBe(false);
  });

  it("preference window is open only while OPEN and before the deadline", () => {
    expect(isPreferenceWindowOpen({ status: "OPEN", preferenceDeadline: deadline }, before)).toBe(true);
    expect(isPreferenceWindowOpen({ status: "OPEN", preferenceDeadline: deadline }, after)).toBe(false);
    expect(isPreferenceWindowOpen({ status: "DRAFT", preferenceDeadline: deadline }, before)).toBe(false);
  });
});
