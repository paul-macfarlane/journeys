# 15: Post-hackathon hardening

Status: needs-triage
Blocked by: None (not part of the hackathon priority order; pick up after 2026-09-25)
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** The loose ends, edge cases, and tricky spots that the hackathon deliberately left alone, turned into production-grade behaviour. Raised by Paul on 2026-09-20 while reviewing ticket 03; add to this list as later tickets record their own deferrals.

- [ ] **Concurrent Draft writes.** Today `saveDraft` is whole-document and last-write-wins (ADR-0001, "Writes are whole-document"). Two Members editing one Draft overwrite each other silently. Decide and build a graceful mechanism: optimistic concurrency on the `draft` row (a version counter the client echoes back, refused with a clear message when stale), per-Step patching, or a soft lock with presence. The Author must never lose work without being told.
- [ ] **Querying inside graph documents.** Not needed today; if a feature needs "which Journeys mention X" or "how many Steps have Prompts", use `jsonb` operators and indexes on the `draft` / published-version documents rather than changing the storage shape (Paul, 2026-09-20). Record the decision in ADR-0001's consequences when it happens.
- [ ] **Rich-text contract gaps.** ~~`hardBreak` (Shift+Enter) is admitted by ticket 40 (Paul, 2026-09-22); this bullet closes when 40 lands.~~ Closed by ticket 40 (2026-09-23): `hardBreak` is in the contract. Still open: an image nested in a list item is dropped at save whatever its attrs (review finding F9, ticket 03; since ticket 30 nothing about an image refuses a write, so the old refuse-versus-drop asymmetry is gone).
- [ ] **Explicit Step order.** The graph document has no ordering for Steps; `Object.values` follows jsonb key order after a round trip (ticket 03, F8). Ticket 08's editor needs a deterministic order; make it part of the document if the editor's answer is not enough.
- [ ] **Deploy window.** Between the Vercel build going live and the Migrate action finishing, pages that depend on a new table fail. Either sequence the deploy after migration or make new code tolerate the previous schema for one release.
- [ ] **Corrupt-row handling.** `getDraftForMember` throws on a row that fails the schema (a 500). Decide whether a recovery path (restore from a Published Version, or a repair tool) is wanted.
- [ ] **Rate limiting and abuse protection on Runs** (spec Out of Scope for the hackathon).
- [ ] **Accessibility pass.** Go through every existing surface (sign-in, Projects, Project tabs, Journey page, canvas, Step panel, rich text editor, runner, preview) with a screen reader and keyboard only; fix names, roles, focus order, contrast, and reduced-motion. Ticket 30 adds image alt text and ticket 31 checks contrast, but neither is the full pass (Paul, 2026-09-21, item 18).
- [ ] **Manual layout (ticket 17).** Deferred past the hackathon on 2026-09-21; Paul is not convinced it earns its complexity. Reconsider only if Authors ask for it.
- [ ] **Drag-and-drop Journey ordering** — ticket 41 (Paul, 2026-09-22, item 4).
- [ ] **SEO** — ticket 42 (item 8); run after the rename if there is one. Ticket 43 (jev) moved to the hackathon nice-to-have sweep and is not listed here.
- [ ] **Renaming the app** — ticket 44 (item 2), needs Paul's name and domain.
- [ ] **Atlas setup refresh** — ticket 45 (item 10), a grilling session first.
- [x] **Cookie consent banner.** Decided no banner (agent recommendation, 2026-09-22, Paul's item 7): the app sets only the better-auth session cookie, the participant id, and the per-Journey Run cookie, all needed to provide what the person asked for, and no analytics or advertising cookie; those are the strictly-necessary class that consent rules exempt, and `/privacy` already names them. Revisit if analytics, embedded media, or a third-party script is ever added. Not legal advice.
- [ ] **Anything later tickets defer** — append here with a pointer to the ticket and finding.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
