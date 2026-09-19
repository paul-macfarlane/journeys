# 12: Prompts and Responses

Status: ready-for-agent
Blocked by: 06, 08
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** An Author attaches an optional free-text Prompt to a Step (label, required/optional) in the side panel and sees a one-line notice that Responses are anonymous and must not ask for identifying information. A Participant sees a textbox on that Step and answers before choosing (or skips if optional). Responses are stored per Run and step; Members read them in a plain per-step list; Participants never see others' Responses. `prompt.type` accepts only `free_text`.

- [ ] Prompt editing in the panel, with the notice; required flag enforced in the runner.
- [ ] Response saved with the Run and step id; skipping an optional Prompt saves nothing.
- [ ] Per-step Response list for Members, no participant identifiers; non-Members forbidden.
- [ ] Preview never stores Responses.
- [ ] Seam B: author adds a Prompt → participant answers → author reads it.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
