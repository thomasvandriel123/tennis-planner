"use client";

import { startTransition, useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { Weekday } from "@/generated/prisma/enums";
import { submitPreference, type SubmitPreferenceState } from "../actions";

const SKILL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function PreferenceForm({
  periodId,
  periodWeekdays,
  existing,
  preview = false,
}: {
  periodId: string;
  periodWeekdays: Weekday[];
  existing: {
    preferredWeekdays: Weekday[];
    skillLevel: number;
    notes: string | null;
  } | null;
  /** Render the form disabled, for the organiser's preview of the player view. */
  preview?: boolean;
}) {
  const t = useTranslations("periods.preferenceForm");
  const tWeekdays = useTranslations("periods.weekdays");
  const [state, formAction, pending] = useActionState<SubmitPreferenceState, FormData>(
    submitPreference,
    { errors: [], saved: false },
  );

  // Fully controlled so the player's input survives the action round trip.
  const [weekdays, setWeekdays] = useState<Weekday[]>(existing?.preferredWeekdays ?? []);
  const [skillLevel, setSkillLevel] = useState(existing ? String(existing.skillLevel) : "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const toggleWeekday = (weekday: Weekday, checked: boolean) =>
    setWeekdays((current) =>
      checked ? [...current, weekday] : current.filter((d) => d !== weekday),
    );

  const hasPreference = existing !== null || state.saved;

  // Dispatch the action ourselves rather than via `<form action>`: React 19
  // resets the form after an action, which drops the controlled skill <select>.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preview) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="periodId" value={periodId} />
      <fieldset disabled={preview} className="flex flex-col gap-4">
        {state.errors.length > 0 && (
          <ul className="rounded-md border border-clay/40 bg-clay/10 px-4 py-3 text-sm text-clay">
            {state.errors.map((error) => (
              <li key={error}>{t(`errors.${error}`)}</li>
            ))}
          </ul>
        )}
        {state.saved && state.errors.length === 0 && (
          <p className="rounded-md border border-court/40 bg-court/10 px-4 py-3 text-sm text-court dark:text-ball">
            {t("saved")}
          </p>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t("weekdaysLabel")}</legend>
          <div className="flex flex-wrap gap-2">
            {periodWeekdays.map((weekday) => (
              <label
                key={weekday}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-sm has-checked:border-court has-checked:bg-court/10"
              >
                <input
                  type="checkbox"
                  name="weekdays"
                  value={weekday}
                  checked={weekdays.includes(weekday)}
                  onChange={(e) => toggleWeekday(weekday, e.target.checked)}
                  className="accent-court"
                />
                {tWeekdays(weekday)}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("skillLabel")}
          <select
            name="skillLevel"
            required
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
            className="rounded-md border border-line px-3 py-2 text-base"
          >
            <option value="" disabled>
              {t("skillPlaceholder")}
            </option>
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <span className="font-normal text-foreground/60">{t("skillHelp")}</span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("notesLabel")}
          <textarea
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-md border border-line px-3 py-2 text-base"
          />
        </label>

        <button
          type="submit"
          disabled={pending || preview}
          className="self-start rounded-md bg-court px-4 py-2 text-sm font-medium text-white hover:bg-court-dark disabled:opacity-50"
        >
          {pending ? t("submitting") : hasPreference ? t("update") : t("submit")}
        </button>
      </fieldset>
    </form>
  );
}
