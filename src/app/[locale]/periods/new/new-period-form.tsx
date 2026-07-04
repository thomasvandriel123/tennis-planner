"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { WEEKDAYS, type PeriodFormInput } from "@/lib/periods";
import { createPeriod, type CreatePeriodState } from "../actions";

const inputClass = "rounded-md border border-line px-3 py-2 text-base";
const labelClass = "flex flex-col gap-1 text-sm font-medium";

const EMPTY_VALUES: PeriodFormInput = {
  name: "",
  startDate: "",
  endDate: "",
  weekdays: [],
  startTime: "",
  endTime: "",
  preferenceDeadline: "",
  price: "",
  trainerIds: [],
};

export function NewPeriodForm({
  trainers,
}: {
  trainers: { id: string; label: string }[];
}) {
  const t = useTranslations("periods.new");
  const tWeekdays = useTranslations("periods.weekdays");
  const [state, formAction, pending] = useActionState<CreatePeriodState, FormData>(
    createPeriod,
    { errors: [], values: null, submission: 0 },
  );
  // React resets the form's fields to their defaults once the action returns;
  // remounting keyed on the submission count with the echoed values as the
  // new defaults keeps the organiser's input on a validation error.
  const defaults = state.values ?? EMPTY_VALUES;

  return (
    <form key={state.submission} action={formAction} className="flex flex-col gap-5">
      {state.errors.length > 0 && (
        <ul className="rounded-md border border-clay/40 bg-clay/10 px-4 py-3 text-sm text-clay">
          {state.errors.map((error) => (
            <li key={error}>{t(`errors.${error}`)}</li>
          ))}
        </ul>
      )}

      <label className={labelClass}>
        {t("nameLabel")}
        <input
          type="text"
          name="name"
          required
          placeholder={t("namePlaceholder")}
          defaultValue={defaults.name}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          {t("startDateLabel")}
          <input
            type="date"
            name="startDate"
            required
            defaultValue={defaults.startDate}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          {t("endDateLabel")}
          <input
            type="date"
            name="endDate"
            required
            defaultValue={defaults.endDate}
            className={inputClass}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("weekdaysLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((weekday) => (
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          {t("startTimeLabel")}
          <input
            type="time"
            name="startTime"
            required
            defaultValue={defaults.startTime}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          {t("endTimeLabel")}
          <input
            type="time"
            name="endTime"
            required
            defaultValue={defaults.endTime}
            className={inputClass}
          />
        </label>
      </div>

      <label className={labelClass}>
        {t("deadlineLabel")}
        <input
          type="datetime-local"
          name="preferenceDeadline"
          required
          defaultValue={defaults.preferenceDeadline}
          className={inputClass}
        />
        <span className="font-normal text-foreground/60">{t("deadlineHelp")}</span>
      </label>

      <label className={labelClass}>
        {t("priceLabel")}
        <input
          type="text"
          name="price"
          required
          inputMode="decimal"
          placeholder="300"
          defaultValue={defaults.price}
          className={inputClass}
        />
        <span className="font-normal text-foreground/60">{t("priceHelp")}</span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("trainersLabel")}</legend>
        <span className="text-sm text-foreground/60">{t("trainersHelp")}</span>
        {trainers.length === 0 ? (
          <p className="text-sm text-foreground/60">{t("trainersEmpty")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {trainers.map((trainer) => (
              <label
                key={trainer.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-sm has-checked:border-court has-checked:bg-court/10"
              >
                <input
                  type="checkbox"
                  name="trainerIds"
                  value={trainer.id}
                  defaultChecked={defaults.trainerIds.includes(trainer.id)}
                  className="accent-court"
                />
                {trainer.label}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-court px-4 py-2 font-medium text-white hover:bg-court-dark disabled:opacity-50"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
