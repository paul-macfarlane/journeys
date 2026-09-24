import { z } from "zod";

/**
 * Author pages (ticket 52): the display name, bio, and links an Author may
 * choose to make public at `/authors/<userId>`, plus the closed set of link
 * kinds the Settings page lists and the public page renders in the same
 * order. Pure and database-free on purpose, like `src/lib/theme.ts`: the
 * Settings form, its server actions, and the public page all read the same
 * definitions from here.
 */

export const AUTHOR_NAME_LIMIT = 60;
export const AUTHOR_BIO_LIMIT = 1000;
export const AUTHOR_LINK_LIMIT = 5;

/**
 * The five link kinds, in the order the Settings page lists them and the
 * page renders them. `host` is the hostname (bare, no `www.`) a platform
 * kind's URL must sit on; `website` has none, so any `https:` host passes.
 */
export const AUTHOR_LINK_KINDS = [
  { kind: "linkedin", label: "LinkedIn", host: "linkedin.com" },
  { kind: "github", label: "GitHub", host: "github.com" },
  { kind: "instagram", label: "Instagram", host: "instagram.com" },
  { kind: "facebook", label: "Facebook", host: "facebook.com" },
  { kind: "website", label: "Website", host: null },
] as const;

export type AuthorLinkKind = (typeof AUTHOR_LINK_KINDS)[number]["kind"];

const linkKindIds = AUTHOR_LINK_KINDS.map((entry) => entry.kind) as [
  AuthorLinkKind,
  ...AuthorLinkKind[],
];

export const authorLinkKindSchema = z.enum(linkKindIds, {
  error: "Choose one of the link kinds",
});

export type AuthorLink = { kind: AuthorLinkKind; url: string };

export const authorNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(AUTHOR_NAME_LIMIT, "Use 60 characters or fewer");

/** Blank allowed; `trim()` touches only the ends, so an inner line break stays. */
export const authorBioSchema = z
  .string()
  .trim()
  .max(AUTHOR_BIO_LIMIT, "Use 1,000 characters or fewer");

export const authorPublicSchema = z.boolean();

/**
 * The profile picture as a link (Paul, 2026-09-24: Authors may change it;
 * images stay URL-only per the spec): an absolute `http:` or `https:` URL,
 * the same rule a Step's image `src` is held to, or blank for none, which
 * shows the Author's initials instead. Trimmed, at most 2,048 characters.
 */
export const authorImageSchema = z
  .string()
  .trim()
  .max(2048, "Use 2,048 characters or fewer")
  .refine((value) => {
    if (value === "") return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Use a link that starts with https:// or http://");

const hostByKind = new Map<AuthorLinkKind, string | null>(
  AUTHOR_LINK_KINDS.map((entry) => [entry.kind, entry.host]),
);

const labelByKind = new Map<AuthorLinkKind, string>(
  AUTHOR_LINK_KINDS.map((entry) => [entry.kind, entry.label]),
);

/**
 * One URL for one kind: an absolute `https:` URL, at most 2048 characters,
 * whose hostname (lowercased) is the kind's host or `www.` + that host;
 * `website` accepts any hostname. The input is trimmed first.
 */
export function authorLinkUrlSchema(
  kind: AuthorLinkKind,
): z.ZodType<string, string> {
  const host = hostByKind.get(kind) ?? null;
  return z
    .string()
    .trim()
    .max(2048, "Use 2,048 characters or fewer")
    .superRefine((value, ctx) => {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "Use an https:// link" });
        return;
      }
      if (url.protocol !== "https:") {
        ctx.addIssue({ code: "custom", message: "Use an https:// link" });
        return;
      }
      if (host !== null) {
        const hostname = url.hostname.toLowerCase();
        if (hostname !== host && hostname !== `www.${host}`) {
          ctx.addIssue({ code: "custom", message: `Use a link on ${host}` });
        }
      }
    });
}

/**
 * One `{ kind, url }` entry as the Settings form sends it: `url` is checked
 * against `authorLinkUrlSchema(kind)`, so the same rule applies whichever
 * kind is picked. The parsed output is an `AuthorLink` with the trimmed url.
 */
export const authorLinkSchema = z
  .object({
    kind: authorLinkKindSchema,
    url: z.string(),
  })
  .transform((value, ctx): AuthorLink => {
    const parsed = authorLinkUrlSchema(value.kind).safeParse(value.url);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: "custom", message: issue.message, path: ["url"] });
      }
      return z.NEVER;
    }
    return { kind: value.kind, url: parsed.data };
  });

/** At most five links, one per kind. */
export const authorLinksSchema = z
  .array(authorLinkSchema)
  .max(AUTHOR_LINK_LIMIT, "Use five links or fewer")
  .refine(
    (links) => new Set(links.map((link) => link.kind)).size === links.length,
    "One link per kind",
  );

/** The label for a kind ("LinkedIn"…). */
export function authorLinkLabel(kind: AuthorLinkKind): string {
  return labelByKind.get(kind) ?? kind;
}

/**
 * A stored `links` value read back leniently: the parsed array when it
 * parses, else `[]`. Every row reached storage through `authorLinksSchema`,
 * so the fallback is for a hand-edited row, never something a public page
 * turns into a 404 over.
 */
export function readAuthorLinks(value: unknown): AuthorLink[] {
  const parsed = authorLinksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}
