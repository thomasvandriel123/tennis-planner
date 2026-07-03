import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

  const t = await getTranslations("dashboard");
  const userId = session.user.id;

  const [upcomingAssignments, pendingPayments] = await Promise.all([
    db.assignment.findMany({
      where: {
        userId,
        slot: { trainingSession: { status: "SCHEDULED", date: { gte: new Date() } } },
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
                <span>{assignment.slot.trainingSession.date.toLocaleDateString()}</span>
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
                  {(payment.amountCents / 100).toFixed(2)} {payment.currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
