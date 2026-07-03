import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("name"), description: t("tagline") };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Renders this layout (and everything under it) as static per locale
  // instead of on every request. See https://next-intl.dev/docs/getting-started/app-router#static-rendering
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <SiteNav />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
