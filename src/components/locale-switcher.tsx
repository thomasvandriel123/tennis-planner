"use client";

import { useLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

/** A minimal NL/EN toggle. Swaps locale for the current page. */
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 text-sm">
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => router.replace(pathname, { locale: code })}
          aria-current={code === locale}
          className={`rounded px-1.5 py-0.5 uppercase transition-colors ${
            code === locale
              ? "bg-court text-white"
              : "text-foreground/60 hover:text-foreground"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
