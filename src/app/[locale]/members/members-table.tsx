"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

export interface MemberRow {
  id: string;
  lastName: string;
  firstName: string;
  email: string;
  skillLevel: number | null;
  enrolled: boolean;
  notes: string | null;
  paid: boolean;
}

type SortKey = "lastName" | "firstName" | "email" | "skillLevel" | "enrolled" | "paid";
type Direction = "asc" | "desc";

const COLUMNS: { key: SortKey | "notes"; sortable: boolean }[] = [
  { key: "lastName", sortable: true },
  { key: "firstName", sortable: true },
  { key: "email", sortable: true },
  { key: "skillLevel", sortable: true },
  { key: "enrolled", sortable: true },
  { key: "notes", sortable: false },
  { key: "paid", sortable: true },
];

function compare(a: MemberRow, b: MemberRow, key: SortKey, dir: Direction): number {
  const mul = dir === "asc" ? 1 : -1;
  if (key === "skillLevel") {
    if (a.skillLevel === null && b.skillLevel === null) return 0;
    if (a.skillLevel === null) return 1; // nulls always last
    if (b.skillLevel === null) return -1;
    return (a.skillLevel - b.skillLevel) * mul;
  }
  if (key === "enrolled" || key === "paid") {
    return ((a[key] ? 1 : 0) - (b[key] ? 1 : 0)) * mul;
  }
  return a[key].localeCompare(b[key], undefined, { sensitivity: "base" }) * mul;
}

function YesNo({ value }: { value: boolean }) {
  const t = useTranslations("members");
  return (
    <span
      className={
        value
          ? "rounded-full bg-court/10 px-2 py-0.5 text-xs font-medium text-court dark:text-ball"
          : "text-foreground/50"
      }
    >
      {value ? t("yes") : t("no")}
    </span>
  );
}

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const t = useTranslations("members");
  const [sortKey, setSortKey] = useState<SortKey>("lastName");
  const [dir, setDir] = useState<Direction>("asc");

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => compare(a, b, sortKey, dir) || a.lastName.localeCompare(b.lastName),
      ),
    [rows, sortKey, dir],
  );

  const onSort = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir("asc");
    }
  };

  if (rows.length === 0) {
    return <p className="text-foreground/60">{t("empty")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-foreground/60">
          <tr>
            {COLUMNS.map((col) => {
              const active = col.sortable && col.key === sortKey;
              return (
                <th
                  key={col.key}
                  aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                  className="px-4 py-2 font-semibold"
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key as SortKey)}
                      className="flex items-center gap-1 uppercase hover:text-court dark:hover:text-ball"
                    >
                      {t(`col.${col.key}`)}
                      <span className={active ? "text-court dark:text-ball" : "text-foreground/30"}>
                        {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  ) : (
                    t(`col.${col.key}`)
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sorted.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-2 font-medium">{row.lastName || "—"}</td>
              <td className="px-4 py-2">{row.firstName || "—"}</td>
              <td className="px-4 py-2 text-foreground/70">{row.email}</td>
              <td className="px-4 py-2 tabular-nums">{row.skillLevel ?? "—"}</td>
              <td className="px-4 py-2">
                <YesNo value={row.enrolled} />
              </td>
              <td className="px-4 py-2 text-foreground/60">{row.notes || "—"}</td>
              <td className="px-4 py-2">
                <YesNo value={row.paid} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
