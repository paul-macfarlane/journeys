# 40: Underline, strikethrough, quotes, and line breaks in Step content

Status: done
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

### [EXECUTION PLAN] 2026-09-23 — Claude Opus 5.5 (`/implement`, Route: contract)

Direct work in the worktree `.claude/worktrees/40-rich-text-marks/journeys` on `feat/40-rich-text-marks` (off `origin/staging` at `2787421`), no worker delegation, e2e on port 3140 against `journeys_e2e_t40` with a scratchpad dummy env (no `.env.local`). Seams under test, red first: (1) unit, `src/lib/graph/content.ts` — schema, sanitizer, `contentPreview`, `isBlankContent` over the four new shapes, plus the legacy cases and the large fixture sanitizing to themselves; (2) unit, `src/components/runner/rich-text.tsx` — `<u>`, `<s>`, `<br>`, `<blockquote>`; (3) unit, `src/lib/rich-text/extensions.ts` — the editor schema refuses a quote in a list item or a quote, and anything but paragraphs in a quote (added after review); (4) e2e `rich-text-underline-strike-quote`. Verification: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=rich-text-underline-strike-quote pnpm test:e2e`, then two `/code-review` readers.

### [CLOSEOUT] 2026-09-23 — Claude Opus 5.5 (`/implement`, Route: contract)

PR: https://github.com/paul-macfarlane/journeys/pull/50 (base `staging`, comparison SHA `2787421`). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Commits.** 94b83b4 (contract, editor, runner, spec and decisions amendments, ticket 15 item), 44386f1 (review fixes: quote in its own group admitted only by the document, Mod-Shift-b always answered, every shortcut exercised, tidy-ups), 0dd40d1 (tooltip hover fix in the new spec), 1763d2a (evidence).

**Verified run command (code at 0dd40d1):** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && E2E_EVIDENCE=rich-text-underline-strike-quote pnpm test:e2e` — every block `exit=0`; unit 425/425; e2e 96 passed in 3.8m, 0 flaky, retries 0. No migration; `pnpm build` ran inside `pnpm test:e2e`.

| Criterion | Verdict | Evidence |
|---|---|---|
| An Author can underline, strike through, quote, and break lines; the Draft round-trips all four and the runner renders them | PASS | `rich-text-underline-strike-quote`: each mark on by button or shortcut and off by the other, Shift+Enter, Mod+Shift+B; Draft row asserted exactly; reload reads `u`, `s`, `br`, `blockquote` in the editor; published runner reads them with the quote's left rule solid and `font-style: normal`; `test-results/rich-text-underline-strike-quote/editor.png`, `runner.png` (viewed) |
| Every existing fixture document and the three committed legacy documents still validate unchanged | PASS | `test-results/ac-2-existing-documents.txt` |
| The spec and `decisions.md` carry the amendment | PASS | `spec.md` `[SCOPE CHANGE] 2026-09-23` plus the pointer in "Rich text"; `decisions.md` "Amendment for ticket 40"; ticket 15 item closed |
| `pnpm test:e2e` passes once in full at the end | PASS locally; PR CI is the durable proof | `test-results/dod-1-commands.txt`, `dod-1-e2e.txt` |

**AI review (two readers, `/code-review`, diff `2787421...94b83b4`).** *Spec:* one real finding, fixed in 44386f1 — StarterKit's list item (`paragraph block*`) let the editor wrap a list item's second paragraph in a quote, which the save then dropped with its words; the quote now lives in a `quote` group only `QuoteDocument` (`(block|quote)+`) admits, with a schema unit test. Also fixed: Mod-Shift-b could fall through to Bold where no quote fits; Mod+U and Mod+Shift+B were not exercised. Noted: the `> ` input rule (Tiptap's own behaviour) and the ticket-30 pointer in the spec's "Rich text" line are small additions. *Standards:* no hard violations; comment wrapping, class order, the runner's duplicated paragraph hardening, and a spec blank line fixed; accepted as is: the top-level quote dispatch in `sanitizeContent` (the quote is a top-level-only block by contract), screenshot file names (`editor.png`, `runner.png`, as the image spec already does).

**Deviations.** (1) The quote node is defined in-repo with `@tiptap/core` rather than extending `@tiptap/extension-blockquote`, which is not a direct dependency (adding it needs a lockfile commit only Paul can make). (2) The first full capture (load average 115–200 from other sessions) failed 5: one real (a tooltip hover where the pointer already sat, fixed in 0dd40d1) and four in untouched specs (dialog not closing within 10s, aborted navigation) that passed 23/23 on rerun at low load; the final capture is clean.

**Queued for Paul (non-blocking, also in the PR).** The toolbar wraps to two rows at the panel's default width.

**Next in Paul's order:** 43 (sweep 2), then 41 → 42 → 44 → 45.
