# 33: App-styled form refusals and the Outcome field

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (atlas-implement, 2026-09-23)
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) **33** → 34 → 35 → 36 → 37; sweep 2 (nice to have before the judges) 38 → 39 → 40 → 43; sweep 3 (post-hackathon) 41 → 42 → 44 → 45. 14 stays available; 17 is post-hackathon.
Route: polish

**Why:** Advancing past a required Prompt without a Response shows the browser's own "Please fill out this field" bubble, which ignores the app's theme. Paul, 2026-09-22, item 14: "In general, we should avoid this default behavior in the app for inputs because it is inconsistent from our theme." On an Ending's panel the Outcome label sits too close to its field, and the field "looks like a select, but also is a free text input" (item 18).

**Decisions (Paul, 2026-09-22, grilled):**

- Native constraint validation is off across the app: no form relies on the browser's `required`, `pattern`, or `type="email"` bubbles. A refusal is the app's own text beside the field, in the destructive colour, with `aria-invalid` and `aria-describedby` wiring, and the field keeps focus.
- The runner stays JavaScript-free (ticket 27). Its refusal is the server's: the action already redirects with `?notice=response-required`; this ticket renders that refusal at the field, not only above the Step.
- The Outcome field becomes a real select-like control: a button that reads as a select (current Outcome or "No outcome", chevron), opening a listbox with a filter field at its top, the Outcomes with their Ending counts, "No outcome", and "Create outcome “…”" for typed text no Outcome answers to. Rename stays as it is. The label sits a clear `gap-2` above the control, like every other field in the panel.

**What to build:**

- **Runner.** `ResponseField` in `src/components/runner/step-view.tsx` drops the `required` attribute (keep `aria-required`); the two runner forms carry `noValidate`. When the notice is `response-required` or `response-too-long`, the field renders `aria-invalid`, the refusal text directly beneath the textbox (`id` referenced by `aria-describedby`), and the page drops the notice above the Step: one place, the field. The server action's checks are unchanged; `maxLength` stays as a silent cap.
- **Audit.** Every other form: the member add form (`src/components/projects/member-list.tsx` uses `type="email"`), the New project and New journey dialogs, the Settings tabs, the Step panel's Prompt fields, the image dialog, and the sign-in page. Add `noValidate` where a form exists, keep semantic input types for keyboards, and make sure each refusal already comes from zod through `action-result` and renders as app text. Record what was found and changed in the closeout.
- **Outcome field.** Replace the Combobox usage in `OutcomeField` (`src/components/journeys/step-panel.tsx`) with a select-styled trigger plus a listbox; reuse the existing `Combobox` list, keyboard, and clipping logic (`src/components/journeys/combobox.tsx`) rather than adding a dependency. "Find step" keeps its query-only Combobox form. The accessible name of the control is "Outcome"; options keep their name-only accessible names so the `step-editing` specs still read them.
- **Specs.** `runner` gains `runner-required-prompt-refusal`: submit a required Prompt blank, read the refusal text beside the field and `aria-invalid="true"`, and assert no native validation message (`validationMessage` is empty on the textbox). `step-editing` outcome specs follow the new control.

Acceptance criteria:

- [ ] Advancing a required Prompt with an empty Response shows the app's refusal beside the field; no browser validation bubble appears (the textbox's `validationMessage` is empty) and the Run does not advance.
- [ ] No form in the app relies on native constraint validation; the audit list in the closeout names each form and its refusal path.
- [ ] The Outcome control reads as a select when closed, opens a filterable list with Ending counts, "No outcome", and "Create outcome “…”", and its label has visible space above it.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `polish`): commit only the screenshot directories of the specs this ticket names; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, items 14 and 18.

## Comments

### [CLOSEOUT] 2026-09-23 — Claude Fable 5.1 (`/atlas-implement`, Route: polish)

PR: https://github.com/paul-macfarlane/journeys/pull/44 (base `staging`, comparison SHA `747bcc8`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Execution.** Two deliverables in parallel, disjoint files (confirmed against the real diffs at closeout: no shared file between the two commits). D1 (Sonnet worker, direct checkout) 07c546a — `responseRefusal` in `src/components/runner/step-view.tsx`, `ResponseField` refusal at the field (`aria-invalid`, `aria-describedby`, `autofocus`, no `required`, `aria-required`), `noValidate` on the runner forms and both New dialogs, the four runner and Preview pages passing the refusal, the `runner-required-prompt-refusal` spec, `prompts.spec` reading `aria-required` and the server's refusal. D2 (Opus worker, worktree `.claude/worktrees/33-forms-and-outcome-field/journeys` on port 3111 / `journeys_e2e_t33`) 2106c12, cherry-picked as e32186b — `SelectCombobox` in `src/components/journeys/combobox.tsx` with the list, keyboard, and clipping logic extracted into shared helpers, `OutcomeField` on it, `step-editing.spec` and `tagWithOutcome` on the new control. Orchestrator f0d47f1 — review fixes. f558c1c — evidence.

**Verified run command (final tree, head f0d47f1):** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=runner-required-prompt-refusal,panel-outcomes-from-the-ending,step-editing-outcome-rename pnpm test:e2e` — every block `exit=0`; unit 386/386; e2e 89 passed in 1.6m, 0 flaky, retries 0. Docker Postgres :5436, production build on :3100, Chromium.

| Criterion | Verdict | Evidence |
|---|---|---|
| Required Prompt left empty: the app's refusal beside the field, no browser bubble (`validationMessage` empty), the Run does not advance | PASS | `runner-required-prompt-refusal` asserts `aria-invalid="true"`, `aria-describedby` → the alert, `validationMessage === ""`, `noValidate` on the form, focus on the box, no `role="status"` copy above the Step, path unchanged after the refused page renders; `test-results/runner-required-prompt-refusal/runner-required-prompt-refusal.png` (viewed: red-bordered box, refusal beneath it, Choices below) |
| No form relies on native constraint validation; audit list | PASS | Audit below; static check at f0d47f1: 7 `<form>` elements, 5 carry `noValidate` (the two without are the input-less "Start over" forms); no `required`, `pattern`, or `type="url"` on any input; `type="email"` only on the Add member field inside a `noValidate` form |
| Outcome control reads as a select when closed; open, a filterable list with Ending counts, "No outcome", "Create outcome “…”"; label spaced above | PASS | `panel-outcomes-from-the-ending` (closed text "No outcome", `aria-haspopup="listbox"`, `aria-expanded` flips, filter focused on open, ArrowDown/Enter chooses, Escape returns focus, label bottom ≥ 4 px above the button, "2 endings", Create option, case-insensitive duplicate refused) and `step-editing-outcome-rename`; `test-results/panel-outcomes-from-the-ending/outcome-open.png` (viewed: filter on top, "Reached care 2 endings" with a check, "No outcome"), `panel-outcomes-from-the-ending.png` (viewed: closed control with chevron, label above) |
| `pnpm test:e2e` once in full at the end | PASS locally (89/89, 0 flaky); PR CI is the durable proof and is pending at this commit | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt`; PR #44 checks |

**Audit (AC 2).**

| Form | File | Refusal path | Change |
|---|---|---|---|
| Runner Start / Step Prompt (two forms) | `src/components/runner/step-view.tsx` | server redirect `?notice=` → `responseRefusal()` → `role="alert"` beneath the textbox | dropped `required`, `aria-required`/`aria-invalid`/`aria-describedby`/`autofocus`, `noValidate` |
| New project dialog | `src/components/projects/new-project-dialog.tsx` | react-hook-form + zod → `role="alert"` | added `noValidate` |
| New journey dialog | `src/components/journeys/new-journey-dialog.tsx` | react-hook-form + zod → `role="alert"` | added `noValidate` |
| Add member | `src/components/projects/member-list.tsx` | react-hook-form + zod → `role="alert"` | none: already `noValidate`; keeps `type="email"` for the keyboard |
| Settings tabs (`project-settings-fields.tsx`, `journey-title-fields.tsx`, `theme-fields.tsx`) | blur-saved fields, no `<form>` | zod through `action-result`, inline text | none |
| Step panel Prompt fields, image dialog (`rich-text-editor.tsx`) | no `<form>` | editor autosave; `maxLength` stays a silent cap | none |
| Sign-in page | `src/app/sign-in/page.tsx` | OAuth buttons only | none |

**AI review (one Opus reader, both axes, diff `747bcc8..e32186b`).** 0 blocking, 6 non-blocking. Fixed in f0d47f1: the runner spec read the Run's path before the action could have answered (now after `aria-invalid`); Safari/Firefox do not focus a button on click, so the filter's blur would close and the click reopen the list (mousedown `preventDefault` on the trigger while open and on the list's non-input surface); the filter is a `role="combobox"` with `aria-autocomplete="list"` and `aria-expanded` so the active option is announced (specs locate it by that role); one `knownNotice` lookup shared by refusal and confirmation. Accepted as deviations: Tab/Shift+Tab out of the open list has no spec (works in Chromium); the trigger copies `Input`'s classes by hand and omits the `disabled:`/`aria-invalid:` variants it never takes (no shadcn select primitive to reuse).

**Deviations.** (1) The Preview Start page (`preview/page.tsx`) gained a `notice` read and refusal plumbing for symmetry with the runner, though the preview action redirects refusals to the per-step route, so that path is unreachable today. (2) `prompts.spec`'s "crafted request past the browser's check" block was removed: with `noValidate` unconditional the plain click is that request. (3) Option order is Outcomes → "No outcome" → "Create outcome", the ticket's order (it used to lead with "No outcome"). (4) `e2e/canvas.spec.ts` changed one `toHaveValue` to `toHaveText` on the Outcome field. (5) `pnpm build` was not run on its own: `pnpm test:e2e` builds the app.

**Queued for Paul (non-blocking, also in the PR).** Deviations 1–3 above, should any of them read wrong.

**Next in Paul's order:** 34 → 35 → 36 → 37 (sweep 1), then 38 → 39 → 40 → 43.
