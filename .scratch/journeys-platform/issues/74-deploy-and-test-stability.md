# 74: Deploy and test stability

Status: ready-for-agent
Blocked by: 72
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish (no schema, auth, or route change)

**Why:** stability was Paul's first priority after bug fixes (2026-09-26). Two problems recur.

1. **Stale tabs after a deploy** (ticket 66 finding 3). A tab opened before a deploy throws `ChunkLoadError` on its first client-side navigation and stays on the old build until a hard reload.
2. **An e2e suite that fails under load.** Tickets 60, 61, 62, 63, 65, and 69 each record full runs failing unrelated specs when the machine is busy. `metadata-autosave` turned out to be a real race (fixed in 69 with `router.replace` in `UrlTabs`). The others have been rerun rather than diagnosed.

**What to build:**

- **Chunk-load recovery.** A client-side handler that catches a chunk-load failure and reloads the page once. A `sessionStorage` marker stops a reload loop, with every storage access in try/catch (ticket 35: Chrome throws on storage access). **Paul's, as a Vercel setting (agents do not change cloud configuration):** turn on Skew Protection under Project → Settings → Advanced, so old assets keep serving and the reload is rarely needed. Record it in `human-prerequisites.md`.
- **Flake hunt.** Run the full suite with `--repeat-each 3` under artificial CPU load (for example a parallel `pnpm build` loop). Diagnose every failure to its cause with a trace, using the held-`page.route` technique from ticket 69, and fix the cause in the app or the spec. Raising timeouts or retries is not a fix. List each flake and its cause in the `[CLOSEOUT]`.
- **Deploy window** (ticket 15). Already policy in `CLAUDE.md`: every migration stays compatible with the previously deployed code. Close ticket 15's bullet with a pointer to that rule. Nothing to build.

Acceptance criteria:

- [ ] A page loaded against build A, then navigated after build B replaces it, reloads once onto B (unit test on the handler, plus a manual check on staging after a deploy, recorded in the closeout).
- [ ] `pnpm test:e2e --repeat-each 3` passes in full under the load recipe, and the recipe is written into `docs/agents/testing.md`.
- [ ] Skew Protection is listed in `human-prerequisites.md` for Paul.

Verification follows `docs/agents/testing.md` (`polish`). Use `CONTEXT.md` vocabulary. Origin: ticket 66 finding 3; ticket 15; the load notes on tickets 60–69.

## Comments

### 2026-09-26: design to follow (ticket 72)

Ticket 72 read the e2e suite for load sensitivity. Take these into the flake hunt; each is a cause to confirm with a trace, not a timeout to raise.

**Suspects to reproduce first (72 finding T2):**

- **A transient state asserted.** `projects-and-journeys.spec.ts:652` expects "Unsaved changes", which is only on screen for `SAVE_DEBOUNCE_MS` (600 ms) before the held write turns it into "Saving…". Under load, the check can land late. Assert on the held `next-action` request instead, or on a state that persists until the spec releases it.
- **`expectSaved` before a direct database write.** About 12 sites in `canvas.spec.ts` (for example 1520, 1604, 2034) wait for "Saved", then write the Draft row directly and reload. If the edit's status has not yet left "Saved", `expectSaved` passes at once, and the pending autosave can overwrite the database write. Wait on the save's server-action response, or poll the stored row, as `readDraft` does elsewhere.
- **One-shot reads.** Poll these instead:
  - `canvas.spec.ts:2628-2629` (computed opacity during a transition; see ticket 63's `toHaveCSS` lesson)
  - `canvas.spec.ts:287` (`count()` before an action)
  - `canvas.spec.ts:1901` (branching on `count() === 0`)
  - `canvas.spec.ts:2130-2174` (`zoomOf` read once)
  - `projects-and-journeys.spec.ts:622` (`wouldAskBeforeLeaving()` once)
- **Negative assertions that pass immediately.** `canvas.spec.ts:1153` and `analytics.spec.ts:349` check `toHaveCount(0)` straight after the action. Assert the positive state first, then the absence.
- **Default 30 s budgets.** `metadata-autosave` has three `toPass({ timeout: 20_000 })` blocks, and `author-settings.spec.ts:79, 115` has two, both under the default test timeout. Find what makes a retry slow before touching any budget.

**Shared helpers (72 finding T3).** The same helpers are copied across specs; one fix should land in one place. Move these into `e2e/setup/`:

- `readDraft` (3 copies, plus `readDraftRow` and `readDraftDocument`)
- `expectSaved` (2)
- `startJourney` (4)
- `renameStep` (2)
- `addChoiceToStep` (2)
- `publishOne` (2)
- `promptBox` (2)
- `directionRadio` (2)
- `fitWholeMap`/`clickBox` beside `analytics.spec`'s `expectMapFitted`
- **the held server-action route**, reimplemented at `projects-and-journeys.spec.ts:643, 767` and `runner.spec.ts:461`: add a `holdServerAction(page)` returning `{ request, release }`

Each helper keeps its strictest variant (the canvas `startJourney` adds the `overflowAnchor` init script).

**Chunk-load recovery placement.** Mount the handler once in the root layout as a small client component. Wrap every `sessionStorage` access in try/catch. Ticket 83 adds `error.tsx` and `global-error.tsx`; a `ChunkLoadError` that reaches them should also get the reload-once path, so share one `isChunkLoadError` helper between the handler and the error pages.
