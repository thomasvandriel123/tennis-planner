import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isOrganiser } from "@/lib/rbac";
import { redirect } from "@/i18n/navigation";
import { PeriodSelect } from "./period-select";
import { MembersTable, type MemberRow } from "./members-table";

/** Split a legacy single `name` into first/last as a fallback. */
function fallbackName(name: string | null): { firstName: string; lastName: string } {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const i = trimmed.lastIndexOf(" ");
  return i === -1
    ? { firstName: trimmed, lastName: "" }
    : { firstName: trimmed.slice(0, i), lastName: trimmed.slice(i + 1) };
}

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!isOrganiser(session)) redirect({ href: "/", locale });

  const [t, periods] = await Promise.all([
    getTranslations("members"),
    db.trainingPeriod.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  if (periods.length === 0) {
    return (
      <div className="flex flex-col gap-6 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-foreground/60">{t("noPeriods")}</p>
      </div>
    );
  }

  const { period: periodParam } = await searchParams;
  const selected = periods.find((p) => p.id === periodParam) ?? periods[0];

  // The roster: everyone who holds the PLAYER role, with their status for the
  // selected period (did they sign up? did they pay?).
  const players = await db.user.findMany({
    where: { roles: { some: { role: "PLAYER" } } },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      skillLevel: true,
      preferences: { where: { periodId: selected.id }, select: { notes: true } },
      payments: { where: { periodId: selected.id }, select: { status: true } },
    },
  });

  const rows: MemberRow[] = players.map((p) => {
    const fb = fallbackName(p.name);
    const preference = p.preferences[0];
    return {
      id: p.id,
      lastName: p.lastName ?? fb.lastName,
      firstName: p.firstName ?? fb.firstName,
      email: p.email,
      skillLevel: p.skillLevel,
      enrolled: p.preferences.length > 0,
      notes: preference?.notes ?? null,
      paid: p.payments.some((pay) => pay.status === "PAID"),
    };
  });

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <PeriodSelect periods={periods} selectedId={selected.id} label={t("periodLabel")} />
      </div>
      <MembersTable rows={rows} />
    </div>
  );
}
