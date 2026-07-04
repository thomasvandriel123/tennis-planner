import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isOrganiser, isPlayer } from "@/lib/rbac";
import { redirect } from "@/i18n/navigation";
import {
  canStartFinalPlanning,
  isPreferenceWindowOpen,
} from "@/lib/periods";
import {
  openPeriodForPreferences,
  publishPeriod,
  startFinalPlanning,
} from "../actions";
import { PeriodStatusBadge } from "../period-status-badge";
import { PreferenceForm } from "./preference-form";

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session) redirect({ href: "/sign-in", locale });

  const period = await db.trainingPeriod.findUnique({
    where: { id },
    include: {
      sessions: {
        orderBy: { date: "asc" },
        include: { trainers: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!period) notFound();

  const organiser = isOrganiser(session);
  const player = isPlayer(session);
  // Drafts are only visible to the organiser.
  if (period.status === "DRAFT" && !organiser) notFound();

  const [t, tWeekdays, format, preferences, ownPreference] = await Promise.all([
    getTranslations("periods.detail"),
    getTranslations("periods.weekdays"),
    getFormatter(),
    organiser
      ? db.preference.findMany({
          where: { periodId: period.id },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { submittedAt: "asc" },
        })
      : Promise.resolve([]),
    player
      ? db.preference.findUnique({
          where: { userId_periodId: { userId: session!.user.id, periodId: period.id } },
        })
      : Promise.resolve(null),
  ]);

  const now = new Date();
  const published = period.status === "PUBLISHED";
  const preferenceWindowOpen = isPreferenceWindowOpen(period, now);

  const facts: [string, string][] = [
    [
      t("factDates"),
      format.dateTimeRange(period.startDate, period.endDate, {
        dateStyle: "medium",
        timeZone: "UTC",
      }),
    ],
    [t("factWeekdays"), period.weekdays.map((d) => tWeekdays(d)).join(", ")],
    [t("factTime"), `${period.startTime}–${period.endTime}`],
    [
      t("factPrice"),
      format.number(period.priceCents / 100, {
        style: "currency",
        currency: period.currency,
      }),
    ],
    [
      t("factDeadline"),
      format.dateTime(period.preferenceDeadline, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    ],
  ];

  return (
    <div className="flex flex-col gap-8 py-4">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{period.name}</h1>
          <PeriodStatusBadge status={period.status} />
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

      {organiser && (
        <section className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            {t("organiserTitle")}
          </h2>
          {period.status === "DRAFT" && (
            <form action={openPeriodForPreferences} className="flex flex-col items-start gap-2">
              <input type="hidden" name="periodId" value={period.id} />
              <p className="text-sm text-foreground/60">{t("openHint")}</p>
              <button type="submit" className="rounded-md bg-court px-4 py-2 text-sm font-medium text-white hover:bg-court-dark">
                {t("openButton")}
              </button>
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

      {player && !published && (
        <section className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            {t("preferencesTitle")}
          </h2>
          {preferenceWindowOpen ? (
            <PreferenceForm
              periodId={period.id}
              periodWeekdays={period.weekdays}
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
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          {published ? t("finalScheduleTitle") : t("proposedScheduleTitle")}
        </h2>
        <p className="text-sm text-foreground/60">
          {published ? t("finalScheduleHint") : t("proposedScheduleHint")}
        </p>
        {period.sessions.length === 0 ? (
          <p className="text-foreground/60">{t("noSessions")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {period.sessions.map((trainingSession) => (
              <li
                key={trainingSession.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span>
                  {format.dateTime(trainingSession.date, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                  <span className="text-foreground/60">
                    {" "}
                    · {trainingSession.startTime}–{trainingSession.endTime}
                  </span>
                </span>
                <span className="text-foreground/60">
                  {trainingSession.trainers.length > 0
                    ? trainingSession.trainers.map((tr) => tr.name ?? tr.email).join(", ")
                    : t("noTrainer")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {organiser && period.status !== "DRAFT" && (
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
