import { getTranslations } from "next-intl/server";
import { auth, signOut } from "@/lib/auth";
import { isOrganiser } from "@/lib/rbac";
import { Link } from "@/i18n/navigation";
import { TennisBallMark } from "./tennis-ball-mark";
import { LocaleSwitcher } from "./locale-switcher";
import { NavLinks } from "./nav-links";

export async function SiteNav() {
  const [t, session] = await Promise.all([getTranslations(), auth()]);

  const links = session
    ? [
        { href: "/", label: t("nav.dashboard") },
        { href: "/periods", label: t("nav.trainingPeriods") },
        ...(isOrganiser(session) ? [{ href: "/members", label: t("nav.members") }] : []),
      ]
    : [];

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-court-dark dark:text-ball"
        >
          <TennisBallMark className="h-6 w-6" />
          {t("app.name")}
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium sm:flex">
          <NavLinks links={links} />
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          {session ? (
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-court/5"
              >
                {t("nav.signOut")}
              </button>
            </form>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-md bg-court px-3 py-1.5 text-sm font-medium text-white hover:bg-court-dark"
            >
              {t("nav.signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
