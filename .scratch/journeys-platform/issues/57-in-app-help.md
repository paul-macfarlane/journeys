# 57: In-app help on the authoring surfaces

Status: ready-for-agent
Blocked by: 55
Owner:
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
