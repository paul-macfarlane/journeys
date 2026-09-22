# 30: Rich text editor — image caption, alt text, editing, and tooltips

Status: done
Blocked by: None
Owner: Claude Fable 5.1 (`/implement`, 2026-09-22)
Parent: `.scratch/journeys-platform/spec.md`
Priority: staging feedback round 2 (Paul, 2026-09-21): harness simplification → 24 → 25 → 26 → 27 → 10 → 28 → 29 → **30** → 31 → 23; 17 is post-hackathon.
Route: contract

**Why:** In the editor a selected image is hard to tell from an unselected one, there is no way to edit an image or its text once inserted, "credit" is the wrong name for the line under a picture, images carry no alt text, and the toolbar buttons have no tooltips or hotkey hints. Items 13, 14, 15, 16, and 17 of Paul's 2026-09-21 notes.

**Decisions (Paul, 2026-09-21):** caption and alt text are two fields with different jobs. The caption is the visible line under the image and is optional; a credit is simply written into it. Alt text is for assistive technology, never displayed, and required when inserting or editing an image through the dialog. `credit` is renamed to `caption` in the document contract with a compatibility read so nothing stored breaks.

**What to build:**

- **Contract.** In `src/lib/rich-text/extensions.ts` and the zod content schema (`src/lib/graph/content.ts`): the image node's attrs become `src`, `alt` (string, default `""`), `caption` (string, default `""`). On parse, an attr named `credit` is read as `caption` when `caption` is absent, so every existing Draft, Published Version, and seed document still validates; the next save of a Draft writes `caption`. Published Versions are immutable and are never rewritten; the runner's renderer (`src/components/runner/rich-text.tsx`) accepts both names. `<figure>` renders `<img alt={alt}>` and a `<figcaption>` only when the caption is non-empty. The rich-text unit tests cover the compatibility read and both render shapes.
- **Seeds.** Convert the three committed documents under `scripts/seed/journey-stories/` once: `credit` → `caption`; `alt` is set to `""` (Paul fills real alt text in later, in the editor). The seed command output is unchanged.
- **Image dialog.** The insert dialog gains Alt text (required, with a one-line help: "Describe the image for people who cannot see it") and Caption (optional) fields; the same dialog opens pre-filled from a selected image and updates its attrs on save. Existing images with empty alt text can be edited into compliance; the document never refuses them.
- **Selection.** A selected image node gets a visible ring (`.ProseMirror-selectednode` styled with the focus ring) and a small floating toolbar beside it (Tiptap `BubbleMenu` bound to the image node): "Edit image" (opens the dialog) and "Remove" (deletes the node). Delete and Backspace keep working.
- **Tooltips.** Every toolbar button gets a shadcn `Tooltip` reading its name and, where Tiptap binds one, its shortcut, rendered with ⌘ on macOS and Ctrl elsewhere (read `navigator.platform` once on the client): Bold ⌘B, Italic ⌘I, Heading 1–3 ⌘⌥1–3, Bullet list ⌘⇧8, Ordered list ⌘⇧7, Link ⌘K, Image (no shortcut). `aria-label`s already name the buttons; the tooltip must not duplicate the name into `aria-describedby`.
- **Docs and specs.** `CONTEXT.md` and README where they say "credit"; ticket 15's "Rich-text contract gaps" note. `step-editing-image-credit-and-preview` becomes `step-editing-image-caption-alt-and-preview`: insert with alt and caption, select the image and see the ring and toolbar, edit the caption, publish, and read `alt` and the caption on the runner. A hover on Bold reads the tooltip.

Acceptance criteria:

- [x] Seam A: a stored document with `credit` parses to `caption`; one with `caption` and `alt` parses unchanged; the renderer emits `alt` and omits `<figcaption>` for an empty caption; unit tests cover all three.
- [x] The seed command runs against the converted documents and the case-3 runner shows captions where credits were.
- [x] Inserting an image requires alt text; a selected image shows a ring and "Edit image" / "Remove"; editing the caption and alt updates the rendered figure in the preview and the runner after publish.
- [x] Hovering or focusing each toolbar button shows its tooltip with the platform's shortcut where one exists.
- [x] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `contract`): commit only the screenshot directories of the specs this ticket names plus `ac-1-contract.txt`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-21, items 13–17.

## Comments

### [EXECUTION PLAN] 2026-09-22 — Claude Fable 5.1 (`/implement`, Route: contract)

Direct checkout on `feat/30-rich-text-images-and-tooltips` from `staging` at e94c15b; one session, no worktrees.

1. **Seam A, test-first.** `src/lib/graph/content.ts`: image attrs become `src`, `alt` (string, default `""`), `caption` (string, default `""`); `contentSchema` reads a stored `credit` as `caption` when `caption` is absent; `sanitizeContent` no longer refuses anything for an image (the `SanitizeRefused` path goes). `src/lib/rich-text/extensions.ts`: `CaptionedImage` renders `<img alt>` and a `<figcaption>` only for a non-empty caption. Unit tests in `content.test.ts` and `runner/rich-text.test.tsx` cover the compatibility read, the unchanged parse, and both render shapes. A pure `src/lib/rich-text/shortcuts.ts` formats Tiptap key names for macOS and elsewhere, test-first.
2. **Seeds.** Textual rewrite of the three documents under `scripts/seed/journey-stories/` (`"credit":` → `"caption":`, `"alt": null` → `"alt": ""`), preserving every `\u` escape; the seed command's output is unchanged.
3. **Editor.** The image dialog gains Alt text (required, with its help line) and Caption (optional), opens pre-filled from a selected image, and updates the node's attrs on save; a selected image shows a focus ring and a Tiptap `BubbleMenu` with "Edit image" and "Remove"; every toolbar button gets a shadcn `Tooltip` (`src/components/ui/tooltip.tsx`, vendored from the CLI, stray `cn` package removed) reading its name and platform shortcut; Link gains a `Mod-k` binding inside the editor so the tooltip's ⌘K is true (the window-level Find-step shortcut already yields to a prevented press).
4. **Docs and specs.** `CONTEXT.md` (Caption, Alt text), README, ADR-0001's sanitizer sentence, ticket 15's contract-gaps note; `step-editing-image-credit-and-preview` becomes `step-editing-image-caption-alt-and-preview` (required alt, ring and toolbar, caption edit, runner reads alt and caption, Bold tooltip on hover); the tracked evidence directory moves with it.
5. **Verification.** `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` (via the e2e build), `E2E_EVIDENCE=step-editing-image-caption-alt-and-preview,runner-case-3-on-a-phone pnpm test:e2e` once at the end; `ac-1-contract.txt` and `dod-1-commands.txt` captured; two reviewers (correctness and contract) via `/code-review`; PR to `staging`.

### [AI CODE REVIEW] 2026-09-22 — two readers over `staging...d8a49a9` (Standards, Spec), both Fable 5.1 sub-agents

**Standards.** Hard: `e2e/runner.spec.ts` still said "credit" in three comments (fixed). Judgement: the button label stays "Numbered list" where the ticket says "Ordered list" (kept; neither is a `CONTEXT.md` term). Smells: the `credit → caption` read existed three times with three trims (fixed: one exported `readStoredImageAttrs` in `content.ts` serves the schema, the sanitizer, and the runner; only the sanitizer trims); `imageMode === "edit"` branched three times (kept, small); `apple={apple}` threaded into nine buttons (fixed: `ToolbarButton` calls `useApplePlatform` itself); `handleKeyDown` re-implementing `openLink` (kept — it must not close over the first render's `editor`). **Bug:** the link shortcut fired on Ctrl+K on macOS too (fixed: the platform's `Mod` only, so Ctrl+K on a Mac stays the system's).

**Spec.** Missing/partial: `ac-1-contract.txt` and `dod-1-commands.txt` absent at review time (captured at c18ce1f); the extension had no `credit` read of its own (fixed: `CaptionedImage` declares `credit` and renders it as the caption when `caption` is empty); "Delete and Backspace keep working" unasserted (fixed: the spec now removes with the toolbar, undoes, re-selects, and removes with Backspace); runner.spec wording (fixed). Not asked for: the `Mod-k` binding (kept, flagged to Paul — Tiptap's Link binds nothing, so the tooltip needed it to be true); ADR-0001 and the decisions log amended (kept); `[&_figure]:w-fit` and `[&_img]:rounded-lg` in the editor (kept: the ring hugs the picture). Questionable: none material; nit that the schema does not trim while the sanitizer does (kept: a read must not alter stored values). Verified by the reader: compatibility read and both render shapes with tests, seeds converted with escape counts unchanged (5/6/1), dialog rules, ring and `BubbleMenu`, every shortcut against its Tiptap binding, no `aria-describedby` from Base UI's tooltip.

### [CLOSEOUT] 2026-09-22 — Claude Fable 5.1 (`/implement`, Route: contract)

PR: https://github.com/paul-macfarlane/journeys/pull/35 (base `staging`, comparison SHA e94c15b). Status set to `done` in this commit; merging the PR is Paul's acceptance.

**Deliverables (this session, direct checkout on `feat/30-rich-text-images-and-tooltips`, no workers).** d8a49a9 — the contract (`src/lib/graph/content.ts`: `alt`/`caption`, `credit` compatibility read, no refusal; `CaptionedImage` in `src/lib/rich-text/extensions.ts`; runner renderer), `src/lib/rich-text/shortcuts.ts` (test-first), the seeds converted textually, the editor (dialog with Alt text and Caption in insert and edit modes, ring, `BubbleMenu` with Edit image / Remove, tooltips via vendored `src/components/ui/tooltip.tsx` with the CLI's stray `cn` package removed and the lockfile untouched, `Mod-k`), docs, the renamed spec and its evidence directory. d4aee7e — review fixes (one `readStoredImageAttrs`, `credit` declared on the extension, platform-gated `Mod-k`, `useApplePlatform` inside the button, runner.spec wording, Backspace in the spec). c18ce1f — the spec re-selects the image from the text before Backspace. bae3c9c — evidence.

**Verified run command (final tree, head c18ce1f):** `pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; E2E_EVIDENCE=step-editing-image-caption-alt-and-preview,runner-case-3-on-a-phone pnpm test:e2e` — every block `exit=0`; unit 297/297; e2e 72 passed in 1.4m, 0 flaky, retries 0. Docker Postgres :5436, production build on :3100, Chromium. `pnpm build` ran inside `pnpm test:e2e`; no migration in this ticket.

| Criterion | Verdict | Evidence |
|---|---|---|
| Seam A: `credit` parses to `caption`; `caption`+`alt` parse unchanged; `alt` emitted and `<figcaption>` omitted for an empty caption; unit tests | PASS | `test-results/ac-1-contract.txt` (48/48 over `content.test.ts`, `runner/rich-text.test.tsx`, `shortcuts.test.ts`); `contentSchema` block and the three renderer cases |
| Seed command over the converted documents; case-3 runner shows captions where credits were | PASS | `test-results/ac-2-seed.txt` (same three lines as before the conversion, email redacted); `test-results/runner-case-3-on-a-phone/runner-case-3-on-a-phone.png` (viewed: placeholder image over the Steven Lilley caption) |
| Alt text required; selected image shows ring and Edit image / Remove; editing caption and alt updates the preview and the runner after publish | PASS | `step-editing-image-caption-alt-and-preview`: refusal "Every image needs alt text" with the row still image-free, `selected-image.png` (viewed: ring around the figure, toolbar above it), edit dialog pre-filled, `step-editing-image-caption-alt-and-preview.png` (viewed: preview with the edited caption), `runner.png` (viewed: `alt` and caption on the Published Version); Remove, undo, Backspace |
| Every toolbar button's tooltip shows its name and the platform's shortcut | PASS | same spec: Bold's tooltip reads `Bold ⌘B` / `Bold Ctrl+B`, no `aria-describedby` on the button, tooltip gone after the pointer leaves |
| `pnpm test:e2e` once in full at the end | PASS locally (72/72, 0 flaky); PR CI is the durable proof and is pending at this commit | `test-results/dod-1-commands.txt`, `test-results/dod-1-e2e.txt`; PR #35 checks |

**Deviations.** (1) `Mod-k` is bound inside the editor, which the ticket assumed Tiptap already did; outside the editor ⌘K still focuses "Find step". (2) ADR-0001's sanitizer sentence and the decisions log were amended beyond the ticket's docs list, so no document still says an image without a credit refuses a write; `spec.md` is left as the stable contract and still says "required `credit`". (3) The first full run at d4aee7e failed the new Backspace step (71/72, recorded as FAIL): after Remove then undo, the trace showed the figure back without the `ProseMirror-selectednode` class while a second click on it changed nothing — ProseMirror skips a click whose selection equals the state's. Not reproduced on rerun; the spec now clicks into the text first so the re-selection is a real change, and the ring on a fresh click is proven earlier in the same spec.

**Queued for Paul (non-blocking, also in the PR).** (1) ⌘K inside the editor opens the link dialog now. (2) "Numbered list" stays the button's label. (3) The ring-after-undo observation above, should it show up in use: the state is right (Backspace still deletes), only the ring is missing. (4) Real alt text for the forty seeded images is still to be written in the editor.

**Next in Paul's order:** 31 → 23; 17 post-hackathon.

### [CLOSEOUT] amendment 2026-09-22 — Claude Fable 5.1 (after CI failed three times)

PR: https://github.com/paul-macfarlane/journeys/pull/35, head now the evidence commit after ea0ff4b. Status stays `done`.

**What CI found.** The first three CI runs (9dd9607, d706321, 12aca98) each failed `step-editing-image-caption-alt-and-preview` at the same place — the Remove click straight after a page load timed out at 180 s ("element was detached from the DOM") — while the suite passed locally every time (recorded here as three `FAIL`s; the committed captures are from the local run at the final tree). CI had no Playwright artifacts, so d706321 adds a failure-only `upload-artifact` of `test-results/playwright/` to the workflow. Its trace's screencast showed the image selected with its ring and toolbar, then both gone ~50 ms later with no further input.

**Fixes kept (app).** d706321 — `BubbleMenu`'s `shouldShow` and `options` are module constants; inline values dispatched an options update into the editor on every render. 12aca98 — the `resetKey` effect no longer calls `setContent` on the run its editor's creation triggers: `useEditor` already holds that content, and the redundant replace dropped any selection an Author made in the first moments after the page loaded, which is exactly the window a slow runner's click lands in. The restore path (a real `resetKey` change) still passes (`publish-versions-and-restore`).

**Cut (test).** 12aca98 still failed the same click on CI. Paul (in conversation): cut it rather than dig further; tests must not time out. ea0ff4b drops the spec's post-publish tail (toolbar Remove, undo, Backspace). Everything the ticket names for the spec — insert with alt and caption, ring and toolbar on selection, caption edit, publish, `alt` and caption on the runner, Bold's tooltip — is asserted before that point, and "Remove" is still asserted visible in the toolbar. "Delete and Backspace keep working" is therefore unasserted e2e; ProseMirror's own key handling was not changed.

**Verified run command (final tree, head ea0ff4b):** `pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; E2E_EVIDENCE=step-editing-image-caption-alt-and-preview,runner-case-3-on-a-phone pnpm test:e2e` — every block `exit=0`; unit 297/297; e2e 72 passed in 1.3m, 0 flaky, retries 0. Evidence replaced in place. CI result on ea0ff4b is recorded in the PR.
