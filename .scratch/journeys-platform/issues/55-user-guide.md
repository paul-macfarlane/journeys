# 55: The user guide

Status: done
Blocked by: 38
Owner: Claude (Fable 5.1), 2026-09-24
Parent: `.scratch/journeys-platform/spec.md`
Priority: hackathon presentation (Paul, 2026-09-24, grilled the same evening): runs in a worktree parallel to 54 after 38 merges; the first ticket to cut if the night runs late. In-app help is ticket 57, post-hackathon.
Route: polish

**Why:** Paul, 2026-09-24, at 54's grilling: "a user guide could be nice not just for the judges, but also for normal users and authors. That way judges can use it if they really want." Judges cannot author without a Google or Discord sign-in, and the guide is the help they get instead of a demo account or a tour.

**What is true today:** there is no help of any kind: no guide, no tooltips beyond control labels, no empty-state copy that teaches. The vocabulary is in `CONTEXT.md`. Ticket 54 adds the footer's Guide link and the splash's link to `/guide`, so this ticket does not touch `SiteFooter` or `src/app/page.tsx`. Ticket 38 writes the stills under `public/demo/`.

**Decisions (Paul, 2026-09-24):** one static page at `/guide`, public, product voice, prose with the 38 stills where they fit. No in-app tour.

**What to build:**

- `src/app/guide/page.tsx` with `metadata` (title "Guide", a description) and an in-page table of contents. Sections, using `CONTEXT.md` terms:
  - **For Authors:** sign in; create a Project; create a Journey; the canvas (Steps, Choices, dragging a Choice onto bare map, direction, fit, undo); the Step panel and rich text with images and credits; Prompts and the AI-decided Choice; Themes; publish a Version, restore, Preview; share the link; read analytics on the graph; Members and Author pages.
  - **For Participants:** what a Run is, anonymity (no account, nothing identifying stored), going back when the Journey allows it, Endings.
  - **Good to know:** discovery is link-only; a Published Version never changes under a Participant; where Responses are visible (Members only).
- A "Guide" link in the Projects page header next to the existing controls, so signed-in Authors find it.
- Spec `guide`: heading, the table of contents links resolve to sections, one still renders, both themes, 375 px.

Acceptance criteria:

- [ ] `/guide` renders for an anonymous visitor in both themes and at phone width with the Author, Participant, and Good-to-know sections and uses only `CONTEXT.md` vocabulary.
- [ ] It is reachable from the Projects page header (the footer and splash links come from 54).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and one full `pnpm test:e2e` pass at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): `dod-1-commands.txt` plus the `guide` screenshot directory (`E2E_EVIDENCE=guide`). Never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul, 2026-09-24, at 54's grilling.

## Comments

### 2026-09-24 — [CLOSEOUT] Claude (Fable 5.1), `/implement` from a worktree

- **PR:** https://github.com/paul-macfarlane/journeys/pull/67 (`feat/55-user-guide` → `staging`, base `93cb26b`). Worktree `.claude/worktrees/55/journeys`, `E2E_PORT=3155`, `E2E_DATABASE_NAME=journeys_e2e_55`, dummy env exported from a scratch script.
- **Delivered:** `src/app/guide/page.tsx` (metadata, contents list, the three sections, six stills per theme); a Guide link in the Projects page header; `src/components/prose-page.tsx` (the shell the guide and both legal pages share) and `src/components/demo-still.tsx` (the still the guide and the landing poster share); `e2e/guide.spec.ts` with `guide` and `guide-link-from-projects`.
- **Commands** (`test-results/dod-1-commands.txt`): `pnpm lint`, `pnpm typecheck`, `pnpm test` (544), `pnpm build`, `E2E_EVIDENCE=guide,guide-link-from-projects pnpm test:e2e:prebuilt` — 106 passed, all PASS.
- **A first full run was FAIL:** `canvas-connect-and-retarget-by-dragging` expected two Choice arrows and found one, while another session's suite and builds ran at the same time (load average 15–26). The ticket touches nothing on the canvas. The second run, cited above, passed clean; its capture replaced the first.
- **Evidence:** `test-results/guide/guide-light.png`, `guide-dark.png`, `guide-375.png`; `test-results/guide-link-from-projects/projects-header.png`. The second directory is not named by the ticket; it is the proof of the "reachable from the Projects page header" criterion.
- **Acceptance criteria:** `/guide` for an anonymous visitor in both themes and at 375 px with the three sections — PASS (`guide`). Reachable from the Projects header — PASS (`guide-link-from-projects`). Command chain — PASS.
- **AI Code Review** (one reviewer, Standards + Spec axes, on `e229633`):
  - Spec: `dod-1-commands.txt` and the closeout missing (pending at review time; now present). Reachability evidence showed `/guide`, not the header (fixed: the spec screenshots the Projects page before clicking). Prose wrong against the app: "Step actions" does not add a Choice (it offers add next Step, duplicate, zoom to Step, make the Start, delete); no "Fit" control exists (the map fits itself on open and on a direction change); a new Step comes from the box's connect dot, not the arrow's head (the head retargets an existing Choice); Versions only restore into the Draft, there is no make-live; Members are added by email of an account that has signed in, not invited; "saved line near the title" sits in the editor's header; "opening the link again begins a new Run" contradicted "on the first Choice". Vocabulary: "answer" for Response. All fixed in `119ff53`. "Option" and "snapshot" appear in `CONTEXT.md`'s own definitions and were left.
  - Standards: hard — the shell duplicated `LegalPage` (fixed: `ProsePage`), import order on the Projects page (fixed), `guide-link-from-projects` evidence not named by the ticket (kept, stated above). Judgement — `StillImage` repeated the landing poster (fixed: `DemoStill`); `SECTIONS` and the section headings repeat ids (fixed: a `Section` component takes the entry); eager PNGs (kept: the lazily loaded stills were blank in the full-page screenshot, and a theme switch shows the other still at once); nav label doubled a visible line (fixed: `aria-labelledby`). Spec determinism, cleanup, and `evidencePath` use confirmed sound.
- **Deviations:** none from the ticket. Ticket 54's footer and splash links are untouched here as the ticket directs.
- **Left for Paul:** merge; the worktree branch and `.claude/worktrees/55/` can go once merged.
