"use client";

import { Link, usePathname } from "@/i18n/navigation";

// Highlights the tab matching the current route in dark green, so the user
// can tell at a glance which section they're in. usePathname() (next-intl)
// returns the path without the locale prefix, e.g. "/periods".
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <>
      {links.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "font-semibold text-court-dark dark:text-ball"
                : "text-foreground/70 hover:text-court"
            }
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
