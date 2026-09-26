# 74: Deploy and test stability

Status: done
Blocked by: 72
Owner: Claude (/atlas-implement, chunk 2)
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

### [CLOSEOUT] 2026-09-26 — Claude Opus 5.5 (`/atlas-implement`, chunk 2, Route: polish within a contract chunk)

PR: https://github.com/paul-macfarlane/journeys/pull/102 (base `staging`, comparison SHA `4f2e8c7`), shared with ticket 85. The chunk's `[EXECUTION PLAN]` and `[AI CODE REVIEW]` are on ticket 85. Status set to `done` in this commit; merging the PR is Paul's acceptance. State log: ready-for-agent → in-progress → ai-review → ready-for-human → done (this commit).

**Deliverables.**

| Deliverable | Worker | Commits | What it did |
|---|---|---|---|
| D2 chunk-load recovery | sonnet | `4884f53` | Reload once after a chunk-load failure |
| D3 flake hunt and shared helpers | opus | `a2755ef`, `78d916e` | Helpers moved to `e2e/setup/`, suspects fixed, load recipe |
| Review fixes | opus | `63d6649`, `7d7553d` | Reload guard, e2e helper fixes |
| D-flake | opus | `7b692b6` | Fix for the one flake the load run found |

**Chunk-load recovery.**
- `isChunkLoadError` lives in `src/lib/chunk-load.ts`. It matches the name `ChunkLoadError` and the "Failed to load chunk" message, which is what Next 16's Turbopack runtime throws, plus the webpack and ESM wordings.
- `ChunkLoadRecovery` is mounted once in the root layout. `error.tsx` and `global-error.tsx` call the same `reloadOnceInBrowser`.
- A `sessionStorage` marker (`journeys:chunk-reload`) allows one reload. It is cleared only when a client-side navigation succeeds, so a failure on every load cannot loop.
- If storage throws, there is no reload: without the marker a loop could not be ruled out.
- The listener also reloads on a chunk-load failure the user did not start. That is accepted: the leave guard still asks before an unsaved edit is lost.

**Flakes found, with their causes.**
1. `author-settings`, found by the load run at `7d7553d` (1 of 360 failed, repeat 1, line 195).
   - Cause: a real app race. `useAutosavedForm`'s adopt effect calls `form.reset(values)` whenever the page refreshes, and every save on the page refreshes it. That reset cleared the refusal on a field the Author had just edited, while keeping the refused text.
   - Trace: the Website refusal is in the DOM snapshot at 95800 ms and gone at 95803 ms, when the revalidated tree from the earlier LinkedIn save committed.
   - The same thing happens with no load: any save elsewhere on Settings erased a visible refusal.
   - Fixed in `7b692b6`: edited fields keep their errors across the reset.
   - Proven by `author-settings-refusal-survives-refresh`, which failed before the fix, and a unit test in `src/components/autosaved-form.test.tsx`.
2. `metadata-autosave`: its 20 s `toPass` had a latent race, found by reading the code (`a2755ef`). The leave guard was asked after typing, so once the save had landed, a retry typed the same text, which is no edit and can never pass. The spec now holds the write and asks the guard while it is held.
3. Ticket 72's other T2 suspects were fixed at their cause (`a2755ef`):
   - A transient "Unsaved changes" assertion became an await on the held request.
   - Eleven `expectSaved`-then-database-write sites go through `seedDraft`, which moves the Draft's version so a pending save is refused as stale rather than overwriting the seeded document.
   - One-shot reads are now polled.
   - The positive state is asserted before each absence.

   The other 20 s budgets (`metadata-autosave` title, `author-settings`) were not touched: no failure pointed at them.

Before the fixes, D3's two loaded runs, at `a2755ef` and `78d916e`, each passed 360/360.

| Criterion | Verdict | Evidence |
|---|---|---|
| A page on build A, navigated after build B replaces it, reloads once onto B | Unit half: PASS. Staging half: open, Paul after merge | `test-results/74-ac-1-chunk-load-unit.txt`. Staging recipe below. |
| `pnpm test:e2e --repeat-each 3` passes in full under the load recipe, and the recipe is in `docs/agents/testing.md` | PASS | `test-results/74-ac-2-repeat-each-under-load.txt` (363 passed, 0 failed, 0 flaky at `7b692b6`). Recipe: `docs/agents/testing.md`, "Flaky tests: the load recipe". |
| Skew Protection is listed in `human-prerequisites.md` for Paul | PASS | §14; `test-results/chunk-2-commands.txt` |

**Deviations.** The load recipe is its own team-owned section right after the `atlas-v3:testing` end marker. "Flaky tests" sits inside the managed markers, which a setup rerun would overwrite.

**Deploy window (ticket 15).** Closed with a pointer to the `CLAUDE.md` rule.

**Paul owes:**
- **Skew Protection:** Vercel → `journeys` → Settings → Advanced (`human-prerequisites.md` §14).
- **The staging half of AC 1, after merging:**
  1. Open any staging page and leave the tab open.
  2. Merge any later PR so staging redeploys.
  3. Back in the old tab, click an in-app link.
  4. Expected: the page reloads once onto the new build, with no error page.

  With Skew Protection on, the old assets keep serving, so the reload may not be needed at all. Either outcome passes.

**Verified run command.** The chain as on ticket 85, then `sh node_modules/.atlas-c2/load.sh pnpm test:e2e:prebuilt --repeat-each 3` over the chain's build.
