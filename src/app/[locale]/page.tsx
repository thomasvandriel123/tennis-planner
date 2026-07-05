import { getFormatter, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPlayer } from "@/lib/rbac";
import { Link } from "@/i18n/navigation";

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    const t = await getTranslations("home");
    return (
      <div className="flex flex-col items-start gap-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{t("heading")}</h1>
        <p className="max-w-lg text-foreground/70">{t("body")}</p>
        <Link
          href="/sign-in"
          className="mt-2 rounded-md bg-court px-4 py-2 font-medium text-white hover:bg-court-dark"
        >
          {t("cta")}
        </Link>
      </div>
    );
  }

  const [t, format] = await Promise.all([
    getTranslations("dashboard"),
    getFormatter(),
  ]);
  const userId = session.user.id;
  const now = new Date();

  const [openPeriods, upcomingAssignments, pendingPayments] = await Promise.all([
    // Periods a player can still sign up for (open and before the deadline).
    isPlayer(session)
      ? db.trainingPeriod.findMany({
          where: { status: "OPEN", preferenceDeadline: { gt: now } },
          orderBy: { preferenceDeadline: "asc" },
          include: { preferences: { where: { userId }, select: { id: true } } },
        })
      : Promise.resolve([]),
    db.assignment.findMany({
      where: {
        userId,
        slot: { trainingSession: { status: "SCHEDULED", date: { gte: now } } },
      },
      include: { slot: { include: { trainingSession: true } } },
      orderBy: { slot: { trainingSession: { date: "asc" } } },
      take: 5,
    }),
    db.payment.findMany({
      where: { userId, status: "PENDING" },
      include: { period: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8 py-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>

      {openPeriods.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
            {t("openForEnrolmentTitle")}
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {openPeriods.map((period) => (
              <li key={period.id}>
                <Link
                  href={`/periods/${period.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-court/5"
                >
                  <span className="font-medium">{period.name}</span>
                  <span className="flex items-center gap-3 text-sm text-foreground/60">
                    {t("enrolDeadline", {
                      date: format.dateTime(period.preferenceDeadline, { dateStyle: "medium" }),
                    })}
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        period.preferences.length > 0
                          ? "border-court bg-court text-white"
                          : "border-court/40 bg-court/10 text-court dark:text-ball"
                      }`}
                    >
                      {period.preferences.length > 0 ? t("enrolledBadge") : t("enrolBadge")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
          {t("upcomingSessionsTitle")}
        </h2>
        {upcomingAssignments.length === 0 ? (
          <p className="text-foreground/60">{t("upcomingSessionsEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {upcomingAssignments.map((assignment) => (
              <li key={assignment.id} className="flex justify-between px-4 py-3">
                <span>{format.dateTime(assignment.slot.trainingSession.date, { dateStyle: "medium" })}</span>
                <span className="text-foreground/60">
                  {assignment.slot.court} · {assignment.slot.startTime}-{assignment.slot.endTime}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
          {t("paymentStatusTitle")}
        </h2>
        {pendingPayments.length === 0 ? (
          <p className="text-foreground/60">{t("paymentStatusEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {pendingPayments.map((payment) => (
              <li key={payment.id} className="flex justify-between px-4 py-3">
                <span>{payment.period.name}</span>
                <span className="font-medium text-clay">
                  {format.number(payment.amountCents / 100, {
                    style: "currency",
                    currency: payment.currency,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
