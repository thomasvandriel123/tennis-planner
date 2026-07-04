import { defineRouting } from "next-intl/routing";

// Dutch is the club's default language (SPECS.md §7); English is the only
// other supported locale. Add more here if the club ever needs them.
export const routing = defineRouting({
  locales: ["nl", "en"],
  defaultLocale: "nl",
  // "/" serves Dutch; English lives under "/en".
  localePrefix: "as-needed",
  // Always start visitors on Dutch rather than negotiating from the
  // browser's Accept-Language header - most members are Dutch-speaking
  // regardless of OS/browser locale. The switcher (which sets a cookie
  // that's respected on return visits) is how someone opts into English.
  localeDetection: false,
});
