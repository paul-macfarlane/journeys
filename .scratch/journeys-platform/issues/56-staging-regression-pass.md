# 56: The pre-hackathon regression pass on staging

Status: in-progress
Blocked by: 54, 55
Owner: Claude (Fable 5.1), 2026-09-24
Parent: `.scratch/journeys-platform/spec.md`
Priority: hackathon presentation (Paul, 2026-09-24, grilled the same evening): runs after 54 and 55 merge to `staging` and before Paul promotes `staging` → `main` for the 10:00 ET 2026-09-25 deadline.
Route: polish (no code; findings become tickets)

**Why:** Paul, 2026-09-24: "what I am looking for here is a more automated usage of the app and checks for obvious quality gaps." The e2e suite proves behaviour; it never looks at copy, layout at odd widths, dark-mode oddities, empty states, or the feel of a first visit, which is what a judge sees.

**What is true today:** every ticket runs its own specs and CI runs the whole suite, but nobody has walked the deployed app end to end as a stranger since round 4. Staging will be at `https://journeys-staging.paul-macfarlane.com` with the seed Project published (54's Comments).

**Decisions (Paul, 2026-09-24):** an agent thread walks staging in the desktop app's browser pane against a checklist and writes findings. Paul signs in inside the pane himself (OAuth; the agent never enters credentials). A Playwright tour spec against the deployed URL is the post-hackathon version (see Comments).

**What to do:**

1. Anonymous, both themes, desktop and 375 px: `/`, `/about`, `/guide`, `/privacy`, `/terms`, the seed Project page, play one case to an Ending, go back where allowed, paste the root URL into a chat to check the link preview, `/authors/<Paul's id>`.
2. Signed in (Paul signs in once): create a Project and a Journey; on the canvas add three Steps and Choices by dragging, switch direction, fit, undo, redo; write rich text with an image and a credit; add a Prompt with an AI-decided Choice; pick a Theme; publish; Preview; play the Published Version anonymously in a private window including the Prompt; open analytics and confirm the Run is drawn; restore the earlier Version; invite a Member; open the Author page; delete the test Journey and Project.
3. Every page: keyboard-only pass of the main flow, console errors, an accessibility scan with axe (the browser pane can run `axe-core` from a CDN in `javascript_tool`), text overflow at 375 px, dark-mode contrast.

**Deliverables:** a `[FINDINGS]` record in this ticket's Comments listing each finding as `severity — page — what happened — what was expected`, with a screenshot path under `test-results/56-regression-pass/`. Severity `blocks-promotion` for anything a judge would hit in the first two minutes or that loses data; `fix-tonight` for visible copy and layout faults; `post-hackathon` for the rest. Each `blocks-promotion` and `fix-tonight` finding becomes its own ticket (numbered from 58) with `Route: polish`; the rest go on one `post-hackathon` ticket. The thread fixes nothing itself. Paul decides which findings hold the promotion.

Acceptance criteria:

- [ ] Every step in the three lists above was walked on staging, in both themes, and the `[FINDINGS]` record says so, including "no finding" sections.
- [ ] Every finding has a severity, a screenshot, and (for the top two severities) a ticket.
- [ ] The test Project and Journey created in step 2 are deleted afterwards, and no screenshot contains a real participant Response.

Verification and evidence follow `docs/agents/testing.md`: no command chain (no code changes); evidence is the screenshot directory named above. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul, 2026-09-24, at 54's grilling.

## Comments

### 2026-09-24 — post-hackathon follow-up (not this ticket)

A `tour` Playwright spec run against a deployed URL (`E2E_BASE_URL`), minting a session with the existing helpers, that performs list 2 above and an axe scan of every public route, reporting rather than asserting. File it when 56 closes.
