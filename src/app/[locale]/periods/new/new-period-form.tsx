"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { Weekday } from "@/generated/prisma/enums";
import { WEEKDAYS } from "@/lib/periods";
import { createPeriod, type CreatePeriodState } from "../actions";

const inputClass = "rounded-md border border-line px-3 py-2 text-base";
const labelClass = "flex flex-col gap-1 text-sm font-medium";

interface SlotRow {
  weekday: Weekday;
  startTime: string;
  endTime: string;
  capacity: string;
  label: string;
}

const emptyRow = (): SlotRow => ({
  weekday: "MONDAY",
  startTime: "",
  endTime: "",
  capacity: "",
  label: "",
});

export function NewPeriodForm({
  trainers,
}: {
  trainers: { id: string; label: string }[];
}) {
  const t = useTranslations("periods.new");
  const tWeekdays = useTranslations("periods.weekdays");
  const [state, formAction, pending] = useActionState<CreatePeriodState, FormData>(
    createPeriod,
    { errors: [] },
  );

  // Everything is controlled so nothing is lost when the action returns with
  // validation errors (React resets only uncontrolled fields after an action).
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [preferenceDeadline, setPreferenceDeadline] = useState("");
  const [price, setPrice] = useState("");
  const [slots, setSlots] = useState<SlotRow[]>([emptyRow()]);
  const [trainerIds, setTrainerIds] = useState<string[]>([]);

  const updateSlot = (index: number, patch: Partial<SlotRow>) =>
    setSlots((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const addSlot = () => setSlots((rows) => [...rows, emptyRow()]);
  const removeSlot = (index: number) =>
    setSlots((rows) => (rows.length === 1 ? rows : rows.filter((_, i) => i !== index)));
  const toggleTrainer = (id: string, checked: boolean) =>
    setTrainerIds((ids) => (checked ? [...ids, id] : ids.filter((x) => x !== id)));

  return (
    <form action={formAction} className="flex flex-col gap-5">
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
          value={name}
          onChange={(e) => setName(e.target.value)}
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
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          {t("endDateLabel")}
          <input
            type="date"
            name="endDate"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">{t("slotsLabel")}</legend>
        <p className="text-sm text-foreground/60">{t("slotsHelp")}</p>
        <div className="flex flex-col gap-3">
          {slots.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-2 gap-2 rounded-md border border-line p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]"
            >
              <label className="flex flex-col gap-1 text-xs font-medium text-foreground/60">
                {t("slotDay")}
                <select
                  aria-label={t("slotDay")}
                  name="slotWeekday"
                  value={row.weekday}
                  onChange={(e) => updateSlot(i, { weekday: e.target.value as Weekday })}
                  className={inputClass}
                >
                  {WEEKDAYS.map((weekday) => (
                    <option key={weekday} value={weekday}>
                      {tWeekdays(weekday)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-foreground/60">
                {t("slotFrom")}
                <input
                  type="time"
                  aria-label={t("slotFrom")}
                  name="slotStartTime"
                  required
                  value={row.startTime}
                  onChange={(e) => updateSlot(i, { startTime: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-foreground/60">
                {t("slotTo")}
                <input
                  type="time"
                  aria-label={t("slotTo")}
                  name="slotEndTime"
                  required
                  value={row.endTime}
                  onChange={(e) => updateSlot(i, { endTime: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-foreground/60">
                {t("slotCapacity")}
                <input
                  type="number"
                  aria-label={t("slotCapacity")}
                  name="slotCapacity"
                  min={1}
                  required
                  value={row.capacity}
                  onChange={(e) => updateSlot(i, { capacity: e.target.value })}
                  className={`${inputClass} w-20`}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-foreground/60 sm:col-span-1">
                {t("slotLabelField")}
                <div className="flex items-end gap-2">
                  <input
                    type="text"
                    aria-label={t("slotLabelField")}
                    name="slotLabel"
                    placeholder={t("slotLabelPlaceholder")}
                    value={row.label}
                    onChange={(e) => updateSlot(i, { label: e.target.value })}
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => removeSlot(i)}
                    disabled={slots.length === 1}
                    aria-label={t("slotRemove")}
                    className="shrink-0 rounded-md border border-line px-3 py-2 text-sm text-clay hover:bg-clay/5 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              </label>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSlot}
          className="self-start rounded-md border border-court px-3 py-1.5 text-sm font-medium text-court hover:bg-court/5 dark:text-ball"
        >
          {t("slotAdd")}
        </button>
      </fieldset>

      <label className={labelClass}>
        {t("deadlineLabel")}
        <input
          type="datetime-local"
          name="preferenceDeadline"
          required
          value={preferenceDeadline}
          onChange={(e) => setPreferenceDeadline(e.target.value)}
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
          value={price}
          onChange={(e) => setPrice(e.target.value)}
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
                  checked={trainerIds.includes(trainer.id)}
                  onChange={(e) => toggleTrainer(trainer.id, e.target.checked)}
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
