# 74: Deploy and test stability

Status: ready-for-agent
Blocked by: 72
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon order (Paul, 2026-09-26): 71 → 72 → 73 → **74** → 75 → 76 → 77 → 42 → 78 → 79 → 53 → 57 → 80; parked 44, 39, 45.
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
