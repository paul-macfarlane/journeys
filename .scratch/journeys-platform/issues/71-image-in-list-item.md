# 71: An image inside a list item is never silently dropped

Status: done
Blocked by: None
Owner: Claude Opus 5.5 (`/implement`, 2026-09-26)
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon order (Paul, 2026-09-26): **71** → 72 → 73 → 74 → 75 → 76 → 77 → 42 → 78 → 79 → 53 → 57 → 80; parked 44, 39, 45. First because it is confirmed data loss and self-contained; it does not wait for 72.
Route: contract (the rich-text contract's editor side)

**Why:** ticket 68 finding 2 (reproduced twice on production) and ticket 15's "Rich-text contract gaps" (review finding F9, ticket 03). An image inserted while the cursor sits inside a list item shows in the editor as a figure inside the `<li>`, the panel reads "Saved", and the figure is gone when the Step is reopened. Cause: the stored content shape gives a list item paragraphs only, but `CaptionedImage` (`src/lib/rich-text/extensions.ts`) is still in the `block` group, so the editor admits it where the sanitizer drops it. Ticket 40 fixed the same trap for quotes by giving `ParagraphQuote` a group of its own.

**What to build:** make the editor's schema agree with the stored shape, so what the Author sees is what is saved.

- Inserting an image (toolbar, paste, or drop) while the selection is inside a list item places the image as a top-level block directly after the list, as a quote is placed; if the insertion path cannot do that cleanly, the Image control is disabled inside a list item with a tooltip saying why. Pick whichever keeps `extensions.ts` one schema for editor and sanitizer; record the choice in the `[CLOSEOUT]`.
- Pasting HTML with an `<img>` inside an `<li>` lifts the image out the same way rather than dropping it.
- Stored Drafts and Published Versions are unchanged: nothing is migrated, the sanitizer keeps dropping a nested image it is handed.

Acceptance criteria:

- [x] Inserting an image with the cursor in a bullet or numbered list item leaves the image in the document after reopening the Step (e2e: insert, switch Steps, reopen, the figure is there) — or the Image control is disabled there, proven the same way.
- [x] Pasting `<ul><li>text<img …></li></ul>` keeps the image as a top-level figure (unit test on the editor schema).
- [x] Ticket 15's "Rich-text contract gaps" bullet is closed.

Verification follows `docs/agents/testing.md` (`contract`): the full command chain, one full `pnpm test:e2e` at the end, evidence for the one spec this ticket adds. Never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Origin: ticket 68 finding 2; ticket 15.

## Comments

### [EXECUTION PLAN] 2026-09-26 — Claude Opus 5.5 (`/implement`, Route: contract)

Direct work in the worktree `.claude/worktrees/71-image-in-list-item/journeys` on `feat/71-image-in-list-item` (off `origin/staging` at `79a4b0a`), no worker delegation, e2e on port 3171 against `journeys_e2e_71` with a scratchpad dummy env (no `.env.local`). Choice (the ticket's "pick whichever keeps `extensions.ts` one schema"): **lift, not disable** — `CaptionedImage` joins a `figure` group only `QuoteDocument` admits (`(block|quote|figure)+`), as ticket 40 did for the quote, so the editor, the runner, and the sanitizer keep one schema. Seams under test, red first: (1) unit, `src/lib/rich-text/extensions.test.ts` — the schema refuses an image in a list item or a quote, and parsing `<ul><li>text<img></li></ul>` yields a top-level image; (2) unit, `src/lib/rich-text/insert-image.test.ts` (happy-dom) — the Image control, a paste (`view.pasteHTML`), and a drop (`handleDrop` with `posAtCoords` stubbed) place the image directly after the whole list or quote; (3) e2e `rich-text-image-in-list-item`. Verification: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && E2E_EVIDENCE=rich-text-image-in-list-item pnpm test:e2e`, then two `/code-review` readers.

### [AI CODE REVIEW] 2026-09-26 — `/code-review` (standards + spec), diff `79a4b0a...ad678b8`

*Spec:* the first cut placed only the Image control's image after the list; a paste or drop was left to ProseMirror's fitting, which kept the image but split the list (and the word) at the cursor — not "directly after the list" for "(toolbar, paste, or drop)". **Fixed in ed308ca:** `replaceLiftingImages` serves all three — the rest of a pasted or dropped slice lands where it was aimed and every image goes after the whole list or quote; a slice side closed only by a lifted image reopens, so pasted words join the item they land in. Also fixed: the Image control inside a list ignored a text selection (it now replaces it, as at the top). Noted, not changed: the quote gets the same lift (harmless, it is the same stored-shape rule); JSON already holding a nested image still renders nested (stored rows never hold that shape — the sanitizer drops it, unchanged). The ticket 15 bullet and `[CLOSEOUT]` were pending at review time and are in this PR.
*Standards:* no hard violations. Fixed: the image attrs got a named `ImageAttrs` type shared by the command and the editor. Accepted as is: `happy-dom` is used by `insert-image.test.ts` through `@tiptap/html`'s peer rather than a direct devDependency (declaring it changes the lockfile, which is Paul's); `group: "figure"` and the `captionedImage` command key (the `image` key is taken by `@tiptap/extension-image`'s own declaration); the `depth > 1` rule assumes only lists and quotes nest, which the helper's comment now says.

### [CLOSEOUT] 2026-09-26 — Claude Opus 5.5 (`/implement`, Route: contract)

PR: https://github.com/paul-macfarlane/journeys/pull/97 (base `staging`, comparison SHA `79a4b0a`). Status set to `done` in this commit; merging the PR is Paul's acceptance. State log: ready-for-agent → in-progress → ai-review → ready-for-human → done (this commit).

**Choice recorded:** lift, not disable. The Image control, a paste, and a drop aimed inside a list item (or quote) all place the image directly after that whole list or quote; the Image control stays enabled everywhere.

**Commits.** ad678b8 (schema group, `insertImage`, unit + e2e), ed308ca (review fix: `replaceLiftingImages` for paste and drop, selection replaced, `ImageAttrs`), 061f7f3 (records, ticket 15 bullet, evidence), this closeout.

**Verified run command (code at ed308ca):** `pnpm format:check; pnpm lint; pnpm typecheck; pnpm test; E2E_EVIDENCE=rich-text-image-in-list-item pnpm test:e2e` — every block `exit 0`; unit 556/556; e2e 115 passed in 2.2m, 0 flaky, retries 0. No migration; `pnpm build` ran inside `pnpm test:e2e`.

| Criterion | Verdict | Evidence |
|---|---|---|
| Inserting an image with the cursor in a list item leaves the image in the document after reopening the Step | PASS | `rich-text-image-in-list-item`: bullet list "Oil"/"Wick", Image inserted from the last item, `ul + figure` in the editor, switch to "Cellar" and back, figure still after the whole list, Draft row asserted `[bulletList, image]` with the exact attrs; `test-results/rich-text-image-in-list-item/reopened.png` (viewed). Numbered and nested lists: unit tests in `insert-image.test.ts` |
| Pasting `<ul><li>text<img …></li></ul>` keeps the image as a top-level figure | PASS | `test-results/ac-2-paste-lifts-image.txt` (schema parse + paste into a list item + paste of a bare image + drop) |
| Ticket 15's "Rich-text contract gaps" bullet is closed | PASS | `15-post-hackathon-hardening.md` line 12 |
| One full `pnpm test:e2e` at the end | PASS locally; PR CI is the durable proof | `test-results/71-commands.txt` |

**Deviations.** None from the contract. Out of scope, raised as a separate task chip: a pasted heading inside a list item still loses its words at save (the same trap, StarterKit's `paragraph block*` list item).

**Queued for Paul (non-blocking, also in the PR).** `happy-dom` resolves through `@tiptap/html`'s peer; `pnpm add -D happy-dom` would declare it (lockfile commit is yours).

**Next in Paul's order:** 72 (codebase design review, its own thread) → 73.
