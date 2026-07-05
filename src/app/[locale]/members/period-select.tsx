"use client";

import { useRouter, usePathname } from "@/i18n/navigation";

// Switches which period's roster is shown by navigating to ?period=<id>.
export function PeriodSelect({
  periods,
  selectedId,
  label,
}: {
  periods: { id: string; name: string }[];
  selectedId: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      {label}
      <select
        value={selectedId}
        onChange={(e) => router.push(`${pathname}?period=${e.target.value}`)}
        className="rounded-md border border-line px-3 py-2 text-base"
      >
        {periods.map((period) => (
          <option key={period.id} value={period.id}>
            {period.name}
          </option>
        ))}
      </select>
    </label>
  );
}
