import { getFormatter, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isOrganiser } from "@/lib/rbac";
import { Link, redirect } from "@/i18n/navigation";
import { PeriodStatusBadge } from "./period-status-badge";

export default async function PeriodsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session) redirect({ href: "/sign-in", locale });

  const organiser = isOrganiser(session);
  const [t, format, periods] = await Promise.all([
    getTranslations("periods"),
    getFormatter(),
    db.trainingPeriod.findMany({
      // Drafts are the organiser's workbench; members only see periods that
      // have been opened for preferences (or beyond).
      where: organiser ? {} : { status: { not: "DRAFT" } },
      orderBy: { startDate: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        {organiser && (
          <Link
            href="/periods/new"
            className="rounded-md bg-court px-4 py-2 text-sm font-medium text-white hover:bg-court-dark"
          >
            {t("newButton")}
          </Link>
        )}
      </div>

      {periods.length === 0 ? (
        <p className="text-foreground/60">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {periods.map((period) => (
            <li key={period.id}>
              <Link
                href={`/periods/${period.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-court/5"
              >
                <span className="font-medium">{period.name}</span>
                <span className="flex items-center gap-3 text-sm text-foreground/60">
                  {format.dateTimeRange(period.startDate, period.endDate, {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  })}
                  <PeriodStatusBadge status={period.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
