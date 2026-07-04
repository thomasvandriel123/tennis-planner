import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isOrganiser } from "@/lib/rbac";
import { redirect } from "@/i18n/navigation";
import { NewPeriodForm } from "./new-period-form";

export default async function NewPeriodPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!isOrganiser(session)) redirect({ href: "/periods", locale });

  const [t, trainerRoles] = await Promise.all([
    getTranslations("periods.new"),
    db.userRole.findMany({
      where: { role: "TRAINER" },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  // A trainer can hold the role both globally and per-period; offer each
  // person once.
  const trainers = [
    ...new Map(trainerRoles.map(({ user }) => [user.id, user])).values(),
  ].map((user) => ({ id: user.id, label: user.name ?? user.email }));

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 py-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
      <p className="text-sm text-foreground/60">{t("intro")}</p>
      <NewPeriodForm trainers={trainers} />
    </div>
  );
}
