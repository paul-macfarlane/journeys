# 68: Production regression test, 2026-09-24

Status: needs-triage
Blocked by:
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: mixed — each finding below carries `pre-hackathon` or `post-hackathon`; the one pre-hackathon item is a one-minute data change on production (Paul's), not code.
Route: polish (no code; findings become tickets)

**Why:** Paul, 2026-09-24: "Run the final pre-hackathon regression test of production … fix nothing in this session, just record." Production is `https://journeys-mvp-prod.vercel.app` (renamed today from `journeys-ten-virid.vercel.app`, which now returns 404), at `main` = `staging` `95c4aad` (PR #79). Ticket 66 smoked the same code on the old origin this afternoon; this pass walks the new origin end to end, counts every Run it writes to the seed cases, and cleans up after itself.

**Where and how.** The desktop app's browser pane, whose profile held no session on the renamed origin (better-auth cookies are per origin), so Paul signed in inside the pane at 20:27 ET before the baseline; no credentials were entered by the agent. Pointer actions ran at the pane's natural width (`innerWidth` 899 px this session; the screenshot frame is 800 × 884, so pointer coordinates are CSS × 0.89), `get_page_text`/`read_page`/`javascript_tool` for every read, three `computer` screenshots to aim drags, `curl -A Mozilla/5.0` for status codes and link-preview tags. No screenshots are committed. The pane has no private tab: the anonymous half ran in the same profile, which was fresh for this origin (no runner cookie existed: a Run cookie is only ever set by the first Choice from a Preface, `src/app/j/[journeyId]/actions.ts`), and the runner never reads the session, so the Runs it wrote are anonymous by construction. The throwaway play used two extra pane tabs, closed at the end.

## Baseline (before any walk, 20:22–20:28 ET)

`curl` at 20:22 ET: `/`, `/about`, `/guide`, `/privacy`, `/terms`, `/sign-in` are 200 with `<title>` "… · Journeys" (the root is "Journeys"), `og:title` matching, `og:description` set, `og:image` = the origin's `/opengraph-image` (200, `image/png`, 53 409 B), `twitter:card summary_large_image`; `/p/00000000-5eed-4000-8000-000000000001` is 200, title "Journey Stories · Journeys", `og:title` "Journey Stories", `og:image` = its own 35 286 B PNG, **`og:description` empty** (finding 1); `/no-such-route` and `/j/<unknown id>` are 404 with the ticket-60 page ("Page not found · Journeys") and the site's own preview tags; `/projects` 307 → `/` for an anonymous visitor; the Author page (off) 404; `/robots.txt` and `/sitemap.xml` 404 (66 #5); the demo Journey `…000021` 200 "isn't available" (66 #4, #8).

Seed Project, signed in, read at 20:28 ET. Versions tab of each case lists exactly one row, "Version 1 · Live · Sep 24, 2026, 7:04 PM UTC · by Paul Macfarlane". Analytics for Version 1:

| Case | Starts | Completions | Abandoned | Note |
|---|---|---|---|---|
| Case 1 | 1 | 0 | 1 | the one Run stopped on "Moments of Peace in Honduras" (the second Step); Runs by outcome: Abandoned 1 |
| Case 2 | 0 | 0 | 0 | "No runs yet" |
| Case 3 | 0 | 0 | 0 | "No runs yet" |

The seven Runs that tickets 56 and 66 wrote to Case 1 are not in these numbers: every case's Version 1 was published at 19:04 UTC today, so the cases were re-seeded and re-published after those passes and the old Versions' Runs went with them. See "For Paul" on the one Run that remains.

## Findings

`severity — page — what happened — what was expected — disposition`

1. **pre-hackathon** (data, no code) — the seed Project's link preview, `/p/00000000-5eed-4000-8000-000000000001` — `og:description` is empty and there is no `<meta name="description">`, so a judge pasting the Play link into Slack, Discord, or iMessage sees "Journey Stories" with no line under it; the three cases carry descriptions but the Project itself has none (the seed writes Journey descriptions only, `scripts/seed/journey-stories-seed.ts`). Expected: a sentence such as "Three interactive cases for trauma-informed healthcare education." — **Paul**: type a description into the seed Project's Settings on production (the agent does not edit seed content). Post-hackathon: the seed is source code and the source of truth for this Project, but it writes only `title` (its upsert sets `title` and `updatedAt`, so a description typed in Settings survives a re-seed while a fresh database, staging, or the e2e run gets an empty preview); add a `descriptionContent` document per seed Project in `scripts/seed/journey-stories-seed.ts`, in the same change as ticket 66 finding 1's explicit `position` values, and fall back to the site description when any Project's is blank so no Project ever previews empty.
2. **post-hackathon** (data loss) — the Step panel's editor — an image inserted while the cursor sits inside a list item is shown in the editor as a figure inside the `<li>`, the panel reads "Saved", and the figure is gone when the Step is reopened (reproduced twice: on Start, then deliberately on Step C with a same-origin PNG). Cause: the stored content shape gives a list item paragraphs only (`ParagraphQuote`'s comment in `src/lib/rich-text/extensions.ts` describes the same trap for quotes, which ticket 40 fixed by taking the quote out of the `block` group); the image node is still in `block`, so the editor admits it where the store drops it. Expected: the image is lifted out of the list (as a quote is), or the Image button is disabled inside a list item; never a silent drop under "Saved".
3. **post-hackathon** (UX) — the Step panel, after dragging a connect dot onto empty map — the new Step opens with its title focused but "Untitled step" is not selected (`autoFocus` only, `src/components/journeys/step-panel.tsx`), so typing a name yields "Untitled stepStep A"; the same on "Add step". Expected: the placeholder text selected on focus, or an empty title with "Untitled step" as the placeholder.
4. **post-hackathon** (accessibility) — the runner — a Step whose content starts with the editor's H1 renders two `<h1>`s (the Step title, then the content heading). Expected: content headings rendered one level down in the runner (H1 → h2), or the editor offering H2/H3 only. Related: the seed cases' images carry `alt=""` (their credit is a paragraph), which is fine as decorative but worth a look when the seed is next touched.
5. **post-hackathon** (UX note) — "Restore" on a Version whose content equals the Draft — nothing visible changes (no "Unpublished changes", no Draft row, no message), so an Author cannot tell whether the restore happened. Expected: a one-line acknowledgement like Publish's. (Restore itself works: ticket 56 saw "Unpublished changes" when the Versions differed.)
6. **post-hackathon** (UX note) — "Copy link" when the clipboard is refused — the button stays "Copy link" and says nothing; the address is only in the tooltip (by design in `copy-link-button.tsx`). The pane refuses `clipboard.writeText` (`NotAllowedError`), which a locked-down browser or an iframe would too. Expected: show the address inline (a read-only field) when the copy fails.
7. **post-hackathon** (carried from 66, still true on the new origin) — `/robots.txt` and `/sitemap.xml` 404; an unpublished or deleted-then-unpublished Journey's `/j/<id>` is 200 "This journey isn't available"; the demo Journey "A key on the doormat" is a Draft only. Tickets from 66 #3–#5, #8 stand.

## No finding (walked on production, recorded so nobody re-checks)

- **Anonymous, static pages:** every page has one `h1` and a sensible outline (`/` h1 Journeys → h2 What it does → six h3; About h1 + two h2; Guide h1 + three h2 and a "contents" nav labelled by its heading; Privacy nine h2; Terms seven h2; Sign in h1); landmarks `main` + `footer` + `nav[Legal]` everywhere, plus `header` on the prose, not-found, Project, and runner pages (the splash and sign-in have none, by design); no horizontal overflow (`scrollWidth` = `innerWidth`); the splash's two demo videos play and its twelve feature stills are `alt=""` decorative with two described canvas stills; first Tab lands on "Play a Journey — no account needed" on `/`, on the "Journeys" home link on the prose pages and sign-in, on Case 1 on the seed Project page; console clean on every page (the not-found page logs its own 404 resource line, and the pane's console reader keeps that line across later navigations — hard-navigate and read the network log before blaming a page).
- **Anonymous, the seed:** the Project page lists Case 1, 2, 3 in that order with their Goal lines; each Preface is h1 "Preface" with its Goal line, a single "Next", first Tab on Next, no image; Case 1 walked Preface → Moments of Peace in Honduras (Flickr image loads, credit paragraph) → Violence Breeds → Leave → A Remote Village → "← Back" (returned to Violence Breeds at `step-2`) → Leave → Keep moving → Use a coyote (Coyote's migrationpolicy.org image loads) → Next → Go to the Hospital in Juarez → Next → Give up your son → Ending "Nope" ("The end", "Outcome: Gave up your son", Start over); Start over returned to the Preface with only "Next"; on a Step the first Tab is "← Back" (66 #9), on the Ending too; landmarks header/main/footer/nav on every Step. Case 2 and Case 3 opened to their Prefaces from the Project page and backed out with browser Back, writing nothing.
- **Signed in, throwaway "Regression 2026-09-24" → "Regression journey":** New project and New journey dialogs create and land on the new page; three Steps made by dragging the connect dot onto empty map (Start → A, Start → B, B → C), each opening in the panel with the title focused and the map title updating live on blur; the two unlabelled Choices showed as "2 problems" ("Step "Start" has a choice with no label" ×2) until labelled; Left to right, Fit View (all boxes at scale 1), Undo twice (direction, then the rename) and Redo twice (Redo then disabled) all correct; rich text H1, paragraph, quote, bullet list, and a top-level image from an absolute Flickr URL with alt text and a Caption, all persisted across a Step switch; Prompt with Required; AI decides (Required then checked and disabled, with its two explanatory sentences); Outcome "Found the way" created from the picker's "Create outcome" and picked ("4 steps · 1 outcome"); Remove choice on Step B → "1 problem" "Step "Step C" cannot be reached from the start", then Add choice "Onward" → Step C cleared it ("No problems"); "Saved" after every change; Theme "Use a different theme" → Dusk + accent `#7a3b8f`, saved; Publish → "Published Version 1 — participants see it now." with Copy link; Preview of the Draft rendered the image, caption, quote, list, and the Prompt, and on Continue read "The judge picked "Go right" (100%) — a live run would have advanced." with both Choices under "Choose for yourself"; the Published Version in a fresh tab (title "Regression journey · Journeys", console clean, `dusk` class and the plum accent on the frame) took a leftward answer through the judge to Step A in about two seconds, Ending "Found the way"; Analytics: Starts 1, Completions 1, Abandoned 0, 100 %, "Go left 100% · 1 time", the Run on the graph, "Found the way 1 · 100%"; Responses lists the one answer under "Responses are anonymous…"; Unpublish asked "Unpublish this journey?" and the participant link then read "This journey isn't available"; Publish again → "Published Version 2 — participants see it now." and the Versions tab lists Version 2 (Live) and Version 1 with Restore; Restore Version 1 asked "Replace the draft with version 1?" and completed (finding 5); Members: "Add member" with `nobody-regression-68@example.com` refused with "No account has that email — they need to sign up first"; account Settings: "Public Author page" on with a bio produced `/authors/<id>` (id `7Yf01BG27p3MPvY29rrL7aLrT0s3Cn2T`) (200 to an anonymous `curl`, title "Paul Macfarlane · Journeys", the bio in its description, h1 name + h2 Projects listing the throwaway and Journey Stories), then off and the bio cleared (the page 404s anonymously again); Project Settings: title, description (rich text), preset Tide, accent `#0f6e8c` all saved and the page heading followed the title.
- **The judge on production:** live in both Preview and a real Run through the Vercel AI Gateway, each decision within about two seconds.

## Cleanup (in order, all succeeded, 20:46–20:48 ET)

1. Delete journey → "Delete “Regression journey”? … Delete permanently" → the Project page read "No journeys yet".
2. Delete project → "Delete “Regression 2026-09-24 edited”? … Delete permanently" → landed on Your projects listing only Journey Stories and The Allotment.
3. `curl`: the throwaway participant link `/j/667e3ff2-4c62-4c3d-89c2-cea2f6d7b6bb` 404, its public page `/p/76c276ca-d21f-441d-95f9-96e9ce79025a` 404, the Author page 404, the seed Project page still 200.
4. Account Settings re-read: Public Author page off, bio empty, no Author link shown.
5. Seed Project re-read: Case 1, Case 2, Case 3 in that order, each Published, each Versions tab still exactly "Version 1 · Live · Sep 24, 2026, 7:04 PM UTC".
6. Analytics after (Version 1): Case 1 Starts 2 / Completions 1 / Abandoned 1 ("Gave up your son 1 · 50%", Abandoned 1 · 50%); Case 2 0 / 0 / 0; Case 3 0 / 0 / 0. Difference from the baseline: Case 1 +1 Start +1 Completion, Cases 2 and 3 +0, equal to the Runs counted below.
7. The two extra pane tabs closed.

## Runs written to the seed cases

| Case | Runs added | What | When (UTC) |
|---|---|---|---|
| Case 1 | 1 | one completed Run to the Ending "Nope", with one Back | created 2026-09-25 00:29:10, Ending 00:30:27, Start over 00:30:38 |
| Case 2 | 0 | Preface opened, backed out | — |
| Case 3 | 0 | Preface opened, backed out | — |

The two Runs on the throwaway Journey (one Preview, one live) went with it when it was deleted; the throwaway's one Response was the agent's own and is paraphrased above. No seed-case Response exists (the seed cases have no Prompts).

## Pane technique (for the next pass)

Everything in ticket 66's notes still holds. New this time: the pane profile's session is per origin, so a domain rename logs it out (Paul signs in inside the pane; the agent never enters credentials); `left_click_drag` from the connect dot onto empty map creates a Step in one call, but read the dot's rect with `javascript_tool` first and scale CSS coordinates by (screenshot frame ÷ `innerWidth`); ref-based clicks on map boxes can go stale after the panel switches Steps (click by fresh coordinates or use "Find step…"); `cmd+a` is not delivered to the page (use `form_input` to replace a value); the console reader accumulates across navigations, and `read_network_requests` only buffers the latest requests; a Run is created only by the first Choice from a Preface, so Prefaces can be opened freely; Wikimedia thumbnail URLs return 400 to hotlinkers, so use the seed's Flickr image or a same-origin PNG when an image is needed.

## For Paul

**Before and after, Version 1 of each case:**

| Case | Before (20:28 ET) | After (20:48 ET) | Added by this pass |
|---|---|---|---|
| Case 1 | Starts 1 · Completions 0 · Abandoned 1 | Starts 2 · Completions 1 · Abandoned 1 | 1 (completed, "Gave up your son") |
| Case 2 | 0 · 0 · 0 | 0 · 0 · 0 | 0 |
| Case 3 | 0 · 0 · 0 | 0 · 0 · 0 | 0 |

**ET window of the walks:** 2026-09-24 20:29:00 – 20:31:30 ET (2026-09-25 00:29:00 – 00:31:30 UTC). The only Run of this pass started at 00:29:10 UTC.

**Statement to run from your own terminal against production** (Responses cascade with the Run; the seed cases have none):

```sql
DELETE FROM run
WHERE version_id IN (
  SELECT pv.id FROM published_version pv
  JOIN journey j ON j.id = pv.journey_id
  WHERE j.project_id = '00000000-5eed-4000-8000-000000000001'
)
AND started_at BETWEEN '2026-09-25 00:29:00+00' AND '2026-09-25 00:31:30+00';
```

**Flagged:** the one Run in the baseline (Case 1, abandoned on its second Step, started after the 19:04 UTC publish and before 00:22 UTC) is outside that window and the statement leaves it alone. Its shape matches ticket 66's own smoke ("one abandoned Run on Case 1, stopped on its second Step"), but nothing in the app proves it was not a real participant's, so it is never to be deleted or quoted on that assumption; if you know your afternoon pass wrote it, widen the window yourself. Every other number in the before and after tables is accounted for by this pass.

**Also for you:** finding 1 (a description on the seed Project, one minute in Project Settings) before the form goes in at 10:00 ET.

Acceptance criteria: triage findings 2–7 into tickets or `wontfix` lines here; finding 1 is Paul's data change.

Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul, 2026-09-24, "final pre-hackathon regression test of production".
