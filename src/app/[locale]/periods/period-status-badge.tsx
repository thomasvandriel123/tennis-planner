import { getTranslations } from "next-intl/server";
import type { PeriodStatus } from "@/generated/prisma/enums";

const STATUS_STYLES: Record<PeriodStatus, string> = {
  DRAFT: "border-line text-foreground/60",
  OPEN: "border-court/40 bg-court/10 text-court dark:text-ball",
  ASSIGNING: "border-clay/40 bg-clay/10 text-clay",
  PUBLISHED: "border-court bg-court text-white",
  ARCHIVED: "border-line text-foreground/40",
};

export async function PeriodStatusBadge({ status }: { status: PeriodStatus }) {
  const t = await getTranslations("periods.status");
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {t(status)}
    </span>
  );
}
