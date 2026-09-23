# 40: Underline, strikethrough, quotes, and line breaks in Step content

Status: ready-for-agent
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 3 (Paul, 2026-09-22, grilled the same day): sweep 1 (hackathon) 33 → 34 → 35 → 36 → 37; sweep 2 (nice to have before the judges) 38 → 39 → **40** → 43; sweep 3 (post-hackathon) 41 → 42 → 44 → 45. 14 stays available; 17 is post-hackathon.
Route: contract

**Why:** Paul, 2026-09-22, item 12: "Support for underline, strike through, quote, other nice text features (this is low priority)." The rich-text contract (`src/lib/graph/content.ts`) allows bold, italic, and link marks and paragraph, heading, list, and image blocks; `src/lib/rich-text/extensions.ts` switches `underline`, `strike`, and `blockquote` off to match.

**Scope change:** the rich-text contract gains two marks (`underline`, `strike`), one block (`blockquote`, holding paragraphs), and the `hardBreak` inline node (Shift+Enter), which ticket 15 had left open and Paul admitted on 2026-09-22 (Q12). Inline code, horizontal rules, alignment, and highlight stay out. Record a `[SCOPE CHANGE]` on the spec's content contract and an amendment in `.scratch/journeys-platform/decisions.md` as part of this ticket. Additive only: every stored Draft and Published Version still parses, and Published Versions are never rewritten. Close the `hardBreak` item on ticket 15 when this lands.

**What to build:**

- **Contract.** `Mark` gains `{ type: "underline" }` and `{ type: "strike" }`; `Block` gains `blockquote` with paragraph children; inline content admits `hardBreak`; the zod schema, `sanitizeMarks`, the block sanitizer, and `contentPreview` follow. Unit tests for round trips and for a blockquote nested where it is not allowed (dropped, never refused).
- **Editor.** Enable the four in `extensions.ts`; toolbar buttons with tooltips and shortcuts (Mod+U, Mod+Shift+S, Mod+Shift+B) in `rich-text-editor.tsx` and `shortcuts.ts`; the bubble menu keeps its `aria-label`s (ticket 30 lesson).
- **Runner.** `src/components/runner/rich-text.tsx` renders `<u>`, `<s>`, `<br>`, and `<blockquote>` with theme-aware styling (a left rule in the muted colour, italic off so the Author's own emphasis reads).
- **Specs.** `step-editing` gains `rich-text-underline-strike-quote`: apply all three marks and a line break, reload, read them back in the editor, publish, and read them in the runner.

Acceptance criteria:

- [ ] An Author can underline, strike through, quote, and break lines; the Draft round-trips all four and the runner renders them.
- [ ] Every existing fixture document and the three committed legacy documents still validate unchanged (`pnpm test`).
- [ ] The spec and `decisions.md` carry the amendment.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `contract`): commit only the screenshot directories of the specs this ticket names plus `ac-2-existing-documents.txt`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-22, item 12.

## Comments
