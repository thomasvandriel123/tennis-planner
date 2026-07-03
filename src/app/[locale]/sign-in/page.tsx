import { getTranslations } from "next-intl/server";
import { signIn } from "@/lib/auth";
import { routing } from "@/i18n/routing";

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("signIn");
  // Land back on this locale's dashboard, not the (Dutch) default one.
  const redirectTo = locale === routing.defaultLocale ? "/" : `/${locale}`;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
      <p className="text-sm text-foreground/60">{t("helpText")}</p>
      <form
        action={async (formData) => {
          "use server";
          // signIn's 2nd argument is FormData *or* an options object, not
          // both - merge redirectTo into a plain object instead of passing
          // formData and options separately (the latter is silently ignored).
          await signIn("resend", { email: formData.get("email"), redirectTo });
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("emailLabel")}
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-court px-4 py-2 font-medium text-white hover:bg-court-dark"
        >
          {t("submit")}
        </button>
      </form>
    </div>
  );
}
