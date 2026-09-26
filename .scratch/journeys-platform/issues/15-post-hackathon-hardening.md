# 15: Post-hackathon hardening

Status: done
Blocked by: None (not part of the hackathon priority order; pick up after 2026-09-25)
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** The loose ends, edge cases, and tricky spots that the hackathon deliberately left alone, turned into production-grade behaviour. Raised by Paul on 2026-09-20 while reviewing ticket 03; add to this list as later tickets record their own deferrals.

- [x] **Concurrent Draft writes.** ~~Today `saveDraft` is whole-document and last-write-wins (ADR-0001, "Writes are whole-document"). Two Members editing one Draft overwrite each other silently. Decide and build a graceful mechanism: optimistic concurrency on the `draft` row (a version counter the client echoes back, refused with a clear message when stale), per-Step patching, or a soft lock with presence. The Author must never lose work without being told.~~ Closed by ticket 73 (2026-09-26): the `draft` row carries a `version` counter (migration 0011); every save, restore, and publish sends the version it read and is refused as stale when another Member wrote in between. The refused Member keeps their edit on screen, reads "Someone else changed this draft since you opened it. Reload to see their changes.", and reloads; nothing is merged or overwritten (ADR-0001, amended).
- [ ] **Querying inside graph documents.** Not needed today; if a feature needs "which Journeys mention X" or "how many Steps have Prompts", use `jsonb` operators and indexes on the `draft` / published-version documents rather than changing the storage shape (Paul, 2026-09-20). Record the decision in ADR-0001's consequences when it happens.
- [x] **Rich-text contract gaps.** ~~`hardBreak` (Shift+Enter) is admitted by ticket 40 (Paul, 2026-09-22); this bullet closes when 40 lands.~~ Closed by ticket 40 (2026-09-23): `hardBreak` is in the contract. ~~Still open: an image nested in a list item is dropped at save whatever its attrs (review finding F9, ticket 03).~~ Closed by ticket 71 (2026-09-26): the editor no longer puts an image in a list item or a quote; inserted, pasted, or dropped there, it goes directly after that list or quote.
- [ ] **Explicit Step order.** The graph document has no ordering for Steps; `Object.values` follows jsonb key order after a round trip (ticket 03, F8). Ticket 08's editor needs a deterministic order; make it part of the document if the editor's answer is not enough.
- [x] **Deploy window.** ~~Between the Vercel build going live and the Migrate action finishing, pages that depend on a new table fail. Either sequence the deploy after migration or make new code tolerate the previous schema for one release.~~ Closed by ticket 74 (2026-09-26): already policy in `CLAUDE.md` — "every migration must stay compatible with the previously deployed code," because the Migrate action and the Vercel build start together with no ordering guarantee. Nothing to build.
- [x] **Corrupt-row handling.** ~~`getDraftForMember` throws on a row that fails the schema (a 500). Decide whether a recovery path (restore from a Published Version, or a repair tool) is wanted.~~ Closed by ticket 73 (2026-09-26): a Draft row that fails the schema reads as unreadable, never a 500. The Journey page keeps its header and tabs and its Editor tab names the Journey and offers "Restore from Version N" (the newest Published Version), or says no published version exists to restore from; publish refuses an unreadable Draft. Other stored documents: closed by ticket 83 (2026-09-26, same PR): every other stored-document read uses `safeParse`, and an unreadable Published Version is unavailable to Participants and named on the Journey page.
- [ ] **Rate limiting and abuse protection on Runs** (spec Out of Scope for the hackathon).
- [ ] **Accessibility pass.** Go through every existing surface (sign-in, Projects, Project tabs, Journey page, canvas, Step panel, rich text editor, runner, preview) with a screen reader and keyboard only; fix names, roles, focus order, contrast, and reduced-motion. Ticket 30 adds image alt text and ticket 31 checks contrast, but neither is the full pass (Paul, 2026-09-21, item 18).
- [ ] **Manual layout (ticket 17).** Deferred past the hackathon on 2026-09-21; Paul is not convinced it earns its complexity. Reconsider only if Authors ask for it.
- [ ] **Drag-and-drop Journey ordering** — ticket 41 (Paul, 2026-09-22, item 4).
- [ ] **SEO** — ticket 42 (item 8); run after the rename if there is one. Ticket 43 (jev) moved to the hackathon nice-to-have sweep and is not listed here.
- [ ] **Renaming the app** — ticket 44 (item 2), needs Paul's name and domain.
- [ ] **Atlas setup refresh** — ticket 45 (item 10), a grilling session first.
- [x] **Cookie consent banner.** Decided no banner (agent recommendation, 2026-09-22, Paul's item 7): the app sets only the better-auth session cookie, the participant id, and the per-Journey Run cookie, all needed to provide what the person asked for, and no analytics or advertising cookie; those are the strictly-necessary class that consent rules exempt, and `/privacy` already names them. Revisit if analytics, embedded media, or a third-party script is ever added. Not legal advice.
- [ ] **The Step panel as a sheet on narrow screens** — ticket 53 (Paul, 2026-09-23, item 7); ticket 48 only scrolls the stacked panel into view. Note that the panel stacks below `lg` (1024 px), so tablets and small laptops stack too; decide the boundary there.
- [ ] **Author pages and the display name** — ticket 52 (Paul, 2026-09-23, item 4), `needs-info` until its own grilling thread; it may be pulled forward if the grilling finds it light.
- [ ] **Ticket 43 leftovers.** The Step panel's deciding checkbox and the PublishButton's no-key warning have no e2e coverage (ticket 43 closeout); a hedging Response ("I'm not sure…") scores 0.65–0.75 and advances a live Run at the 0.5 threshold. Ticket 49 raises the timeout and adds a pending state; the threshold and the coverage stay here.
- [x] **Metadata forms, last write wins.** ~~Ticket 46 gives the title, description, and Theme forms autosave; two Members editing the same Project title still overwrite each other silently, the same gap as "Concurrent Draft writes" above. Solve both together.~~ Closed by ticket 73 (2026-09-26): each Project and Journey settings write sends the values it was edited from and is stored only while every field it changes still holds them (compare previous value per field), so another Member's change to the same field is refused as stale with the same message, and edits to different fields never collide.
- [x] **Footer on phones.** Decided no change (agent recommendation, 2026-09-23, Paul's item 1): the footer is in normal flow at the end of a flex column, never fixed, so it cannot overlap; on short pages it sits at the bottom edge and on long pages it follows the content. A fixed footer would cost phone screen for nothing.
- [x] **The Journey Themes for the whole app.** Decided no (agent recommendation, 2026-09-23, Paul's item 13): the presets are the Participant's experience and light/dark is the app's preference. Ticket 11 keeps the authoring UI un-themed so a preview contrasts with the chrome; ticket 31 made Trail the brand, and the favicon, wordmark, and OG images would stay Trail under a Slate app; contrast was verified only on the runner and the public Project page, and ticket 35 had to hand-fix the dark canvas controls for one palette. Revisit only as a per-Author preference if Authors ask.
- [ ] **Anything later tickets defer** — append here with a pointer to the ticket and finding.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments

### 2026-09-26 — Claude (Opus 5.5), post-hackathon triage

`[CLOSEOUT]` Split by theme at Paul's request (2026-09-26, Q5); this list is no longer the place to add deferrals. Each bullet's new home:

- Concurrent Draft writes, Metadata forms last write wins, Corrupt-row handling → **73**.
- Querying inside graph documents, Explicit Step order, Rate limiting and abuse protection on Runs → **72** (design review decides; nothing built until then).
- Rich-text contract gaps (image in a list item) → **71**.
- Deploy window → **74** (already policy in `CLAUDE.md`; closes there).
- Accessibility pass → **78**.
- Manual layout (17) → `wontfix`; Drag-and-drop ordering (41) → `wontfix`; SEO (42) → kept, narrowed; Renaming (44) → parked; Atlas refresh (45) → parked; Step panel sheet (53) → kept; Author pages (52) → delivered.
- Ticket 43 leftovers → **76**.
