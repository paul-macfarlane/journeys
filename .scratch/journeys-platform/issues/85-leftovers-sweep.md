# 85: Leftovers sweep: AI-authoring text, dead code, and pure-core test gaps

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: proposed by ticket 72 (2026-09-26) to go early, right after 74, because it is cheap and removes docs that now mislead; Paul to approve the order.
Route: contract (`schema.ts` changes, although this PR commits no migration; see the two-deploy note)

**Why:** ticket 72, findings D1–D5, M6, and T1. Ticket 14 (AI authoring) is `wontfix`. Its code never merged, but its text did. The deletion test also finds a few exports and one dependency with no caller.

**What to build:**

1. **AI-authoring text** (D1). The Judge is the only AI consumer; ticket 80 may add AI editing later.
   - `.env.example:19`: "Anthropic API key for AI authoring (priority 11). Leave empty to hide AI features." It is the Vercel AI Gateway key, and leaving it empty means deciding Prompts let the Participant choose.
   - `src/lib/env.ts:24-26`: the comment "Optional until AI authoring lands". It is optional because the Judge falls back without it.
   - `README.md:39`.
   - `.scratch/journeys-platform/human-prerequisites.md` §6 heading and lines 59 and 61: drop ticket 14. Keep ticket 43, the Fluid note, and the budget alert, and point at ticket 84's spend limit.
   - `docs/adr/0001-graph-as-one-json-document.md:33-34, 112-113`: add a dated note that AI authoring was withdrawn (ticket 14, 2026-09-26), so the "projection" it mentions was never built. Do not rewrite the decision.
   - `.scratch/journeys-platform/spec.md`: mark the "AI authoring" stories (lines 140-148) and the "### AI" section (212-216) withdrawn, with a pointer to the 2026-09-26 scope change. `decisions.md` is a historical log and stays.
   - `CLAUDE.md`'s `src/lib/` line says "Pure, database-free helpers", but `auth.ts` imports `db`, and `session.ts` and `ai/judge.ts` are `server-only` (72 finding M6). Make it say "plus the server-only auth, session, env, and Judge modules".
2. **Unused dependency** (D2). Remove `@tanstack/react-query` from `package.json`; nothing imports it. The `pnpm-lock.yaml` change is Paul's commit (the secret-scrub hook). Also remove it from `spec.md:158`'s stack line and `CLAUDE.md`'s stack line.
3. **Dead exports** (D3):
   - Delete `parseGraphDocument` (`src/lib/graph/document.ts:217`) and its tests. Production uses `graphDocumentSchema.parse` and `prepareDocumentForWrite`.
   - Delete the unreferenced types `ProjectThemeInput` (`src/lib/validation/project.ts:42`), `JourneyThemeInput` (`validation/journey.ts:67`), and `AuthorPageInput` and `AuthorPageVisibilityInput` (`validation/author.ts:40-41`).
   - Replace the 13 raw `Object.hasOwn(….steps, …)` reads with the existing `hasStep` (for example `draft-editor.tsx:208, 334, 698, 880`, `choice-list.tsx:136`, `step-view.tsx:352`, `response-list.ts:87`, both preview pages).
   - Merge the identical callbacks `addNextStep` and `connectToNewStep` (`draft-editor.tsx:737-748, 813-825`).
4. **Stale comments on `position`** (D4). Ticket 17 (manual layout) is `wontfix`, so `position` has no planned reader. Reword `src/lib/graph/layout.ts:19-22`, `src/components/journeys/journey-canvas.tsx:84-85`, and `spec.md:222-224` to say it is an unused legacy field kept only so stored documents parse. Removing it is `wontfix` (see 72).
5. **The dead `project.description` column** (D5). Drizzle's inserts name every schema column, so the deployed code writes `description` on each `createProject`. A drop migration in the same deploy would break inserts while Migrate and Vercel race (the `CLAUDE.md` deploy-window rule). So there are two PRs, back to back:
   - **This ticket's PR:** remove `description` from `src/db/schema.ts`, and do not commit the drop migration `pnpm db:generate` would now produce. The column keeps its default in the database.
   - **The follow-up PR, as soon as Paul has promoted this one to production:** commit that generated `DROP COLUMN` migration. Until it lands, any other ticket that runs `db:generate` must remove the stray drop from its own migration. Take the follow-up before the next ticket that adds a migration (84 in the proposed order), so that never happens.
6. **Pure-core test gaps** (T1):
   - Unit tests for `hasStep`, `hasOutcome`, `readStoredImageAttrs` (`content.ts:158`), and the cookie options in `src/lib/run-cookies.ts`: path scope, `httpOnly`, `secure` in production.
   - **Key-order invariance.** Postgres `jsonb` reorders object keys, and `steps` is a record. Add one table test asserting that `layoutGraph`, `validateForPublish`, `mapOrder`, the analytics functions, and `response-list` give identical results for a document and the same document with its `steps` keys reversed.
   - `validateForPublish` lists problems in raw key order (`validate.ts:58`). Order them by `mapOrder`, or by breadth-first order from the Start, so the Publish dialog's list is stable.

Acceptance criteria:

- [ ] `grep -rni "ai authoring" .env.example README.md src docs/adr` finds only the dated ADR note.
- [ ] `@tanstack/react-query` is gone from `package.json` (the lockfile is Paul's).
- [ ] `project.description` is gone from `schema.ts`, and this PR commits no migration. The closeout records the drop-migration follow-up and when it may run.
- [ ] The new unit tests pass, including key-order invariance. The existing suites pass, plus one full `pnpm test:e2e`.

Verification follows `docs/agents/testing.md` (`polish`). Use `CONTEXT.md` vocabulary. Origin: ticket 72.

## Comments
