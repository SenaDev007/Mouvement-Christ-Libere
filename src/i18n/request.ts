import { getRequestConfig } from "next-intl/server";

/**
 * next-intl configuration — Christ Libère V2.4
 *
 * Supports: fr (default), en
 * Language detection: URL prefix /en/... or browser Accept-Language.
 *
 * Messages are in /messages/{locale}.json
 */

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = (locale || defaultLocale) as Locale;

  return {
    messages: (await import(`../../messages/${resolvedLocale}.json`)).default,
  };
});
