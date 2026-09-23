/**
 * A page's tabs named in its address as `?tab=<name>`, so a reload or a
 * shared link lands on the same one. The first tab is the default and is
 * never written into the address: the plain URL is the page as it opens.
 *
 * Pure and database-free: `UrlTabs` reads the parameter with one and
 * writes it with the other, so the rule lives in one place and is tested
 * without a browser.
 */

/** The tab a request names, or the first when it names none or an unknown one. */
export function readTab<const T extends readonly string[]>(
  tabs: T,
  raw: string | string[] | undefined,
): T[number] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return tabs.find((tab) => tab === value) ?? tabs[0];
}

/** `href` with `tab` named in its query, or with the parameter gone for the default. */
export function withTab(
  href: string,
  tabs: readonly string[],
  tab: string,
): string {
  const url = new URL(href);
  if (tab === tabs[0]) url.searchParams.delete("tab");
  else url.searchParams.set("tab", tab);
  return url.toString();
}
