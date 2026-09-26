# 87: Cut the Judge

Status: in-progress
Blocked by: None
Owner: Claude (chunk 3)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: contract (the graph document's Prompt, the runner and Preview actions, public copy, the privacy page)

**Why:** Paul, 2026-09-26, at the start of chunk 3: "For the sake of simplicity, let's cut the judge feature. If I see a need for it we can add it back later; but right now it adds more complexity and risk than value." Hardening the Judge (ticket 84's abuse limits, ticket 76's "unclear" answer) cost more than the feature was worth, so the feature goes instead. It can come back later as a new ticket.

**Decisions (Paul, 2026-09-26, in the chunk-3 thread):**

1. Chunk 3 becomes 87 → 75. Ticket 76 is `wontfix`. Ticket 84 is `wontfix`, superseded: its A1 (a Response in the address) and A2 (no durable Judge limit) go away with the Judge. Its one surviving part, A3 (unlimited Run creation), becomes a Paul-owned **Vercel Firewall rate-limit rule on `POST /j/*`**, listed in `human-prerequisites.md`. No in-app limiter.
2. Remove the `ai` package, `AI_GATEWAY_API_KEY` (env schema, `.env.example`), and `scripts/decide-probe.ts` / `pnpm decide:probe`. If ticket 80 (AI editing) ever runs, it adds them back.
3. Rewrite the public copy (landing feature grid, `/guide`'s Prompt section, `/privacy`'s AI paragraph), make the seed demo Journey's Prompt non-deciding, and re-record `public/demo/` with `pnpm demo:record`, so nothing shows a feature that no longer exists. The `/privacy` change is a removal; Paul approves it on the PR.
4. Drop `decides` from the Prompt schema. zod strips the unknown key when it reads a stored document, so every Draft and Published Version still parses. A deciding Prompt was always stored with `required: true`, so on a live Journey it becomes an ordinary required Prompt that offers its Choices. A Draft loses the key on its next save. No migration.

**What to build:**

- Runner (`src/app/j/[journeyId]/actions.ts`, both pages): no judge path. A Step with a Prompt offers its Choices as the form's buttons, as a non-deciding Prompt already does. `?decide=`, `?response=`, and `?confidence=` are gone from the runner and from Preview.
- Preview (`preview/actions.ts`, its pages): the same.
- `src/lib/ai/` is deleted: `decide.ts`, `judge.ts`, `rate-limit.ts`, `threshold.ts`, and their tests. `src/components/runner/decide-submit.tsx` is deleted too.
- `step-view.tsx`: no `DecisionView`, `liveDecision`, `previewDecision`, or "Choose for yourself". `isDeciding` leaves `src/lib/graph/prompt.ts`.
- Authoring: the Step panel's "AI decides the next step from the response" checkbox and its hint are removed, as are `setStepPrompt`'s `decides` handling and the Publish button's warning when there is no gateway key.
- Tests and fixtures: `decidingDocument()` and the deciding specs in `runner.spec.ts`, `preview.spec.ts`, and `prompts.spec.ts` are deleted or rewritten. No spec is left asserting the Judge.
- Docs: `CONTEXT.md` loses "Judge", and "Prompt" drops the deciding sentence. The spec gets a `[SCOPE CHANGE]`. `human-prerequisites.md` §6 is retired and the Firewall rule is added. README, `docs/branding.md`, and the ADRs are checked for mentions.

Acceptance criteria:

- [ ] AC-1: Nothing in `src/`, `e2e/`, `scripts/`, `package.json`, or `.env.example` references the Judge: no `src/lib/ai`, no `ai` dependency, no `AI_GATEWAY_API_KEY`, no `decides`, `isDeciding`, `judge`, `decide=`, or `DecideSubmit` (captured grep).
- [ ] AC-2: A stored document whose Prompt carries `decides: true` still parses, and its Prompt reads as a required Prompt with no `decides` key (unit, `document.test.ts`).
- [ ] AC-3: In the runner, a Step with a required Prompt offers its Choices with the textbox, and a Choice taken with a Response saves it and moves on (existing Prompt e2e in `runner.spec.ts`, passing).
- [ ] AC-4: The landing grid, `/guide`, and `/privacy` no longer describe an AI-decided Choice, and `public/demo/` is re-recorded from a seed with no deciding Prompt (screenshot of `/guide`'s Prompt section via the `guide` spec, plus the `pnpm demo:record` output).
- [ ] AC-5: `human-prerequisites.md` lists the Firewall rule on `POST /j/*` as Paul's step and retires the AI Gateway section.

Verification follows `docs/agents/testing.md` (`contract`). Never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Origin: Paul, 2026-09-26; supersedes 76 and 84.

## Comments

### 2026-09-26 — Claude (Opus 5.5), chunk 3

`[EXECUTION PLAN]` One worker in its own worktree, in parallel with ticket 75. The two share no source files; the orchestrator keeps the tracker, spec, `CONTEXT.md`, and `human-prerequisites.md` for itself, so the workers' diffs do not collide. The worker removes the Judge end to end (runner, Preview, authoring, schema, dependency, env, the probe script, specs and fixtures), rewrites the public copy, makes the seed Prompt non-deciding, and re-records `public/demo/`. Evidence per criterion: AC-1 is a captured `rg` (`test-results/87-ac-1-no-judge.txt`); AC-2 is a unit test (`test-results/87-ac-2-decides-stripped.txt`); AC-3 is the existing runner Prompt specs in the full e2e run; AC-4 is the `guide` spec's screenshot plus the re-recorded `public/demo/`; AC-5 is the file itself. The chunk's full chain and full `pnpm test:e2e` run once, at the end.
