# 33: App-styled form refusals and the Outcome field

Status: ready-for-agent
Blocked by: None
Owner:
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
