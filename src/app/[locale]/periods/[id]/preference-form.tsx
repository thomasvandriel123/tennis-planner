"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Weekday } from "@/generated/prisma/enums";
import { MAX_PREFERRED_PARTNERS, WEEKDAYS } from "@/lib/periods";
import { submitPreference, type SubmitPreferenceState } from "../actions";

const SKILL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export interface PreferenceBlock {
  id: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  capacity: number | null;
  label: string | null;
}

export function PreferenceForm({
  periodId,
  blocks,
  members,
  existing,
  preview = false,
}: {
  periodId: string;
  blocks: PreferenceBlock[];
  members: { id: string; label: string }[];
  existing: {
    slotIds: string[];
    skillLevel: number;
    notes: string | null;
    partnerIds: string[];
  } | null;
  /** Render the form disabled, for the organiser's preview of the player view. */
  preview?: boolean;
}) {
  const t = useTranslations("periods.preferenceForm");
  const tWeekdays = useTranslations("periods.weekdays");
  const tDetail = useTranslations("periods.detail");
  const [state, formAction, pending] = useActionState<SubmitPreferenceState, FormData>(
    submitPreference,
    { errors: [], saved: false },
  );

  // Fully controlled so the player's input survives the action round trip.
  const [slotIds, setSlotIds] = useState<string[]>(existing?.slotIds ?? []);
  const [skillLevel, setSkillLevel] = useState(existing ? String(existing.skillLevel) : "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [partnerIds, setPartnerIds] = useState<string[]>(existing?.partnerIds ?? []);
  const [partnerSearch, setPartnerSearch] = useState("");

  const toggle = (id: string, checked: boolean, cap = Infinity) =>
    (list: string[]) =>
      checked ? (list.length < cap ? [...list, id] : list) : list.filter((x) => x !== id);

  const blocksByWeekday = useMemo(
    () => WEEKDAYS.map((wd) => ({ wd, items: blocks.filter((b) => b.weekday === wd) })).filter((g) => g.items.length > 0),
    [blocks],
  );
  const partnersFull = partnerIds.length >= MAX_PREFERRED_PARTNERS;
  const hasPreference = existing !== null || state.saved;

  // Dispatch the action ourselves rather than via `<form action>`: React 19
  // resets the form after an action, which drops controlled <select> values.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preview) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="periodId" value={periodId} />
      <fieldset disabled={preview} className="flex flex-col gap-5">
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

        {/* Availability: pick the specific weekly blocks to join. */}
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">{t("blocksLabel")}</legend>
          {blocksByWeekday.map(({ wd, items }) => (
            <div key={wd} className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                {tWeekdays(wd)}
              </span>
              <div className="flex flex-col gap-2">
                {items.map((block) => (
                  <label
                    key={block.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 text-sm has-checked:border-court has-checked:bg-court/10"
                  >
                    <input
                      type="checkbox"
                      name="slotIds"
                      value={block.id}
                      checked={slotIds.includes(block.id)}
                      onChange={(e) => setSlotIds(toggle(block.id, e.target.checked))}
                      className="accent-court"
                    />
                    <span className="font-medium tabular-nums">
                      {block.startTime}–{block.endTime}
                    </span>
                    {block.label && <span className="text-foreground/70">{block.label}</span>}
                    {block.capacity !== null && (
                      <span className="ml-auto rounded-full bg-court/10 px-2 py-0.5 text-xs text-court dark:text-ball">
                        {tDetail("groupSize", { count: block.capacity })}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
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

        {/* Preferred training partners (optional, up to MAX). */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t("partnersLabel")}</legend>
          <span className="text-sm text-foreground/60">
            {t("partnersHelp", { max: MAX_PREFERRED_PARTNERS })}
          </span>
          {members.length === 0 ? (
            <p className="text-sm text-foreground/60">{t("partnersEmpty")}</p>
          ) : (
            <>
              <input
                type="text"
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                placeholder={t("partnersSearch")}
                className="rounded-md border border-line px-3 py-2 text-base"
              />
              <span className="text-xs text-foreground/50">
                {t("partnersSelected", { count: partnerIds.length, max: MAX_PREFERRED_PARTNERS })}
              </span>
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-line p-1">
                {members.map((member) => {
                  const selected = partnerIds.includes(member.id);
                  const hidden =
                    partnerSearch.trim() !== "" &&
                    !member.label.toLowerCase().includes(partnerSearch.trim().toLowerCase());
                  return (
                    <label
                      key={member.id}
                      hidden={hidden}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-court/5 has-disabled:cursor-not-allowed has-disabled:opacity-40"
                    >
                      <input
                        type="checkbox"
                        name="partnerIds"
                        value={member.id}
                        checked={selected}
                        disabled={!selected && partnersFull}
                        onChange={(e) =>
                          setPartnerIds(toggle(member.id, e.target.checked, MAX_PREFERRED_PARTNERS))
                        }
                        className="accent-court"
                      />
                      {member.label}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </fieldset>

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
