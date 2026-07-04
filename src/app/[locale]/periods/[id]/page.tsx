import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isOrganiser, isPlayer } from "@/lib/rbac";
import { Link, redirect } from "@/i18n/navigation";
import { WEEKDAYS, canStartFinalPlanning, isPreferenceWindowOpen } from "@/lib/periods";
import { openPeriodForPreferences, publishPeriod, startFinalPlanning } from "../actions";
import { PeriodStatusBadge } from "../period-status-badge";
import { PreferenceForm } from "./preference-form";
import { ConfirmSubmitButton } from "./confirm-submit-button";

export default async function PeriodDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { locale, id } = await params;
  const { preview: previewParam } = await searchParams;
  const session = await auth();
  if (!session) redirect({ href: "/sign-in", locale });

  const period = await db.trainingPeriod.findUnique({
    where: { id },
    include: {
      recurringSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
      sessions: { take: 1, include: { trainers: { select: { id: true, name: true, email: true } } } },
      _count: { select: { sessions: true } },
    },
  });
  if (!period) notFound();

  const organiser = isOrganiser(session);
  const player = isPlayer(session);
  // Drafts are only visible to the organiser.
  if (period.status === "DRAFT" && !organiser) notFound();

  // Preview: an organiser looking at the page as a prospective player would.
  const preview = organiser && previewParam === "1";
  const showOrganiserView = organiser && !preview;

  const [t, tWeekdays, format, preferences, ownPreference] = await Promise.all([
    getTranslations("periods.detail"),
    getTranslations("periods.weekdays"),
    getFormatter(),
    showOrganiserView
      ? db.preference.findMany({
          where: { periodId: period.id },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    player && !preview
      ? db.preference.findUnique({
          where: { userId_periodId: { userId: session!.user.id, periodId: period.id } },
        })
      : Promise.resolve(null),
  ]);

  const now = new Date();
  const published = period.status === "PUBLISHED";
  const preferenceWindowOpen = isPreferenceWindowOpen(period, now);
  const offeredWeekdays = WEEKDAYS.filter((d) =>
    period.recurringSlots.some((s) => s.weekday === d),
  );
  const trainers = period.sessions[0]?.trainers ?? [];

  const facts: [string, string][] = [
    [
      t("factDates"),
      format.dateTimeRange(period.startDate, period.endDate, {
        dateStyle: "medium",
        timeZone: "UTC",
      }),
    ],
    [
      t("factPrice"),
      format.number(period.priceCents / 100, { style: "currency", currency: period.currency }),
    ],
    [
      t("factDeadline"),
      format.dateTime(period.preferenceDeadline, { dateStyle: "medium", timeStyle: "short" }),
    ],
  ];
  if (trainers.length > 0) {
    facts.push([t("factTrainers"), trainers.map((tr) => tr.name ?? tr.email).join(", ")]);
  }

  return (
    <div className="flex flex-col gap-8 py-4">
      {preview && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ball bg-ball/15 px-4 py-3 text-sm">
          <span className="font-medium">{t("previewBanner")}</span>
          <Link href={`/periods/${period.id}`} className="font-medium text-court underline dark:text-ball">
            {t("previewExit")}
          </Link>
        </div>
      )}

      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{period.name}</h1>
          {!preview && <PeriodStatusBadge status={period.status} />}
        </div>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-line py-1.5 sm:justify-start">
              <dt className="w-40 shrink-0 text-foreground/60">{label}</dt>
              <dd className="text-right sm:text-left">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* Weekly schedule - what a player reads to know their training times. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          {published ? t("finalScheduleTitle") : t("scheduleTitle")}
        </h2>
        {period.recurringSlots.length === 0 ? (
          <p className="text-foreground/60">{t("noSlots")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {offeredWeekdays.map((weekday) => (
              <div key={weekday} className="rounded-lg border border-line">
                <div className="border-b border-line bg-court/5 px-4 py-2 text-sm font-semibold">
                  {tWeekdays(weekday)}
                </div>
                <ul className="divide-y divide-line">
                  {period.recurringSlots
                    .filter((slot) => slot.weekday === weekday)
                    .map((slot) => (
                      <li
                        key={slot.id}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
                      >
                        <span className="font-medium tabular-nums">
                          {slot.startTime}–{slot.endTime}
                        </span>
                        <span className="flex items-center gap-2 text-foreground/70">
                          {slot.label && <span>{slot.label}</span>}
                          <span className="rounded-full bg-court/10 px-2 py-0.5 text-xs text-court dark:text-ball">
                            {t("groupSize", { count: slot.capacity })}
                          </span>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            <p className="text-sm text-foreground/60">
              {t("sessionsSummary", { count: period._count.sessions })}
            </p>
          </div>
        )}
      </section>

      {showOrganiserView && (
        <section className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            {t("organiserTitle")}
          </h2>
          <Link
            href={`/periods/${period.id}?preview=1`}
            className="self-start rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-court/5"
          >
            {t("previewButton")}
          </Link>
          {period.status === "DRAFT" && (
            <form action={openPeriodForPreferences} className="flex flex-col items-start gap-2">
              <input type="hidden" name="periodId" value={period.id} />
              <p className="text-sm text-foreground/60">{t("openHint")}</p>
              <ConfirmSubmitButton
                label={t("openButton")}
                title={t("confirmOpenTitle")}
                body={t("confirmOpenBody")}
                confirmLabel={t("confirmOpenConfirm")}
                cancelLabel={t("confirmOpenCancel")}
              />
            </form>
          )}
          {period.status === "OPEN" &&
            (canStartFinalPlanning(period, now) ? (
              <form action={startFinalPlanning} className="flex flex-col items-start gap-2">
                <input type="hidden" name="periodId" value={period.id} />
                <p className="text-sm text-foreground/60">{t("startPlanningHint")}</p>
                <button type="submit" className="rounded-md bg-court px-4 py-2 text-sm font-medium text-white hover:bg-court-dark">
                  {t("startPlanningButton")}
                </button>
              </form>
            ) : (
              <p className="text-sm text-foreground/60">{t("waitForDeadline")}</p>
            ))}
          {period.status === "ASSIGNING" && (
            <form action={publishPeriod} className="flex flex-col items-start gap-2">
              <input type="hidden" name="periodId" value={period.id} />
              <p className="text-sm text-foreground/60">{t("publishHint")}</p>
              <button type="submit" className="rounded-md bg-court px-4 py-2 text-sm font-medium text-white hover:bg-court-dark">
                {t("publishButton")}
              </button>
            </form>
          )}
          {published && <p className="text-sm text-foreground/60">{t("publishedNote")}</p>}
        </section>
      )}

      {published && !showOrganiserView && (
        <p className="rounded-lg border border-court/40 bg-court/10 px-4 py-3 text-sm text-court dark:text-ball">
          {t("finalScheduleHint")}
        </p>
      )}

      {/* Preference form: interactive for a player during the window, or a
          disabled preview for the organiser. */}
      {preview ? (
        <section className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            {t("preferencesTitle")}
          </h2>
          <PreferenceForm
            periodId={period.id}
            periodWeekdays={offeredWeekdays}
            existing={null}
            preview
          />
        </section>
      ) : (
        player &&
        !published && (
          <section className="flex flex-col gap-3 rounded-lg border border-line p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
              {t("preferencesTitle")}
            </h2>
            {preferenceWindowOpen ? (
              <PreferenceForm
                periodId={period.id}
                periodWeekdays={offeredWeekdays}
                existing={
                  ownPreference && {
                    preferredWeekdays: ownPreference.preferredWeekdays,
                    skillLevel: ownPreference.skillLevel,
                    notes: ownPreference.notes,
                  }
                }
              />
            ) : ownPreference ? (
              <div className="flex flex-col gap-1 text-sm">
                <p className="text-foreground/60">{t("preferencesClosed")}</p>
                <p>
                  {t("yourPreference", {
                    weekdays: ownPreference.preferredWeekdays.map((d) => tWeekdays(d)).join(", "),
                    skillLevel: ownPreference.skillLevel,
                  })}
                </p>
                {ownPreference.notes && <p className="text-foreground/60">{ownPreference.notes}</p>}
              </div>
            ) : (
              <p className="text-sm text-foreground/60">{t("preferencesClosed")}</p>
            )}
          </section>
        )
      )}

      {showOrganiserView && period.status !== "DRAFT" && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            {t("submittedPreferencesTitle", { count: preferences.length })}
          </h2>
          {preferences.length === 0 ? (
            <p className="text-foreground/60">{t("noPreferencesYet")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-foreground/60">
                  <tr>
                    <th className="px-4 py-2 font-semibold">{t("tablePlayer")}</th>
                    <th className="px-4 py-2 font-semibold">{t("tableSkill")}</th>
                    <th className="px-4 py-2 font-semibold">{t("tableWeekdays")}</th>
                    <th className="px-4 py-2 font-semibold">{t("tableNotes")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preferences.map((preference) => (
                    <tr key={preference.id}>
                      <td className="px-4 py-2">{preference.user.name ?? preference.user.email}</td>
                      <td className="px-4 py-2">{preference.skillLevel}</td>
                      <td className="px-4 py-2">
                        {preference.preferredWeekdays.map((d) => tWeekdays(d)).join(", ")}
                      </td>
                      <td className="px-4 py-2 text-foreground/60">{preference.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
