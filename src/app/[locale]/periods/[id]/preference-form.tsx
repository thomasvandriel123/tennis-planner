"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { Weekday } from "@/generated/prisma/enums";
import type { PreferenceFormInput } from "@/lib/periods";
import { submitPreference, type SubmitPreferenceState } from "../actions";

const SKILL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function PreferenceForm({
  periodId,
  periodWeekdays,
  existing,
}: {
  periodId: string;
  periodWeekdays: Weekday[];
  existing: {
    preferredWeekdays: Weekday[];
    skillLevel: number;
    notes: string | null;
  } | null;
}) {
  const t = useTranslations("periods.preferenceForm");
  const tWeekdays = useTranslations("periods.weekdays");
  const [state, formAction, pending] = useActionState<SubmitPreferenceState, FormData>(
    submitPreference,
    { errors: [], saved: false, values: null, submission: 0 },
  );
  // React resets the form's fields to their defaults once the action returns;
  // remounting keyed on the submission count with the echoed values as the
  // new defaults keeps the player's input visible after saving or an error.
  const defaults: PreferenceFormInput = state.values ?? {
    weekdays: existing?.preferredWeekdays ?? [],
    skillLevel: existing ? String(existing.skillLevel) : "",
    notes: existing?.notes ?? "",
  };
  const hasPreference = existing !== null || state.saved;

  return (
    <form key={state.submission} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="periodId" value={periodId} />

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
                defaultChecked={defaults.weekdays.includes(weekday)}
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
          defaultValue={defaults.skillLevel}
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
          defaultValue={defaults.notes}
          className="rounded-md border border-line px-3 py-2 text-base"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-court px-4 py-2 text-sm font-medium text-white hover:bg-court-dark disabled:opacity-50"
      >
        {pending ? t("submitting") : hasPreference ? t("update") : t("submit")}
      </button>
    </form>
  );
}
