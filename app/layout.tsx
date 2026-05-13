import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { dirFor, isLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "School Gantt",
  description: "Multi-tenant school event calendar",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const messages = await getMessages();
  const t = await getTranslations("a11y");

  return (
    <html dir={dirFor(locale)} lang={locale} className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:rounded-md focus:bg-neutral-900 focus:px-3 focus:py-2 focus:text-white"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div id="main">{children}</div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
