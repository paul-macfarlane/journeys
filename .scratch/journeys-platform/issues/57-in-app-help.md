# 57: In-app help on the authoring surfaces

Status: done
Blocked by: 55
Owner: Claude (Fable 5.1), chunk 6 orchestrator, 2026-09-27
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** Paul, 2026-09-24: the `/guide` page (55) is the hackathon answer; "we can add [in-app help] post hackathon." First-time Authors land on an empty Projects page and an empty canvas with no teaching copy.

**What to consider when triaging:** empty-state copy on the Projects page, the Journeys list, and a new Draft's canvas that says what to do first and links the relevant `/guide` section; a "?" control in the canvas toolbar opening a short keyboard and gesture reference; tooltips on the direction, fit, undo, and publish controls that name the action. No overlay tour library; nothing that changes a stored document.

Acceptance criteria: completed after triage.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`). Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul, 2026-09-24, at 54's grilling.

## Comments

### 2026-09-26 — Claude (Opus 5.5), post-hackathon triage

Triaged (Paul left it to agent discretion, 2026-09-26), kept small to avoid bloat.

**In scope:**

- Empty-state copy on the Projects list, a Project's Journeys list, and a new Draft's map. Each is one or two sentences saying what to do first, with a link to the relevant `/guide` section.
- Placeholders in the Step content editor ("Write what the participant reads…") and the Choice label box ("What the participant clicks") (64 finding 8).

**Out of scope:** the "?" keyboard-reference control, new tooltips, and any tour.

Acceptance: each empty state and each placeholder asserted in e2e; one screenshot per empty state.

### 2026-09-27 — Claude, chunk 6 orchestrator

`[CLOSEOUT]` PR https://github.com/paul-macfarlane/journeys/pull/112 (chunk 6, after ticket 79).

- **Worker:** D2 (Sonnet, worktree `journeys-d2`, 98bc156), run on the chunk branch after all of 79 was integrated. The worker was stopped for a pause after committing, so its report was lost. The orchestrator re-ran its checks on the integrated branch: typecheck, 674 unit tests, lint, format, build, and five specs, 72/72.
- **What landed:**
  - Empty states on the Projects list, a Project's Journeys list, and a brand-new Draft's map. The map one is a plain paragraph above the map, shown while the Draft is one Step with no Choices. Each empty state links `/guide#create-a-project`, `#create-a-journey`, or `#the-canvas`; the guide's h3s gained those ids.
  - The Step content placeholder "Write what the participant reads…" is a hand-rolled, decoration-only Tiptap extension (`src/lib/rich-text/placeholder.ts`), with no new dependency.
  - The Choice label placeholder is "What the participant clicks".
- **`[AI CODE REVIEW]`:** the same single review as ticket 79's closeout, covering the whole chunk. Findings on 57's code were all non-blocking and fixed in R1 (b877359):
  - F4: blankness now lives in plugin state and is recomputed only on doc changes. The CSS covers any first block. `aria-placeholder` is present only while blank. Heading-first and list-first unit cases were added.
  - F5: `editor-placeholders` shows both placeholders on empty fields.
  - F9: the map hint's comment was reworded.
  - No open findings.
- **Verdicts:**
  - Acceptance PASS at b877359:
    - Screenshots `empty-projects-list`, `empty-journeys-list`, `empty-draft-map`: each asserts its copy and link `href`, and the map hint asserts it disappears after "Add choice".
    - `editor-placeholders`: both placeholders.
    - `src/lib/rich-text/placeholder.test.ts`: the decoration never reaches `getJSON()` or the HTML.
  - Full suite 144 passed, 0 flaky (`test-results/chunk-6-commands.txt`).
- **Command chain:** the same single chunk-end chain as ticket 79's closeout.
