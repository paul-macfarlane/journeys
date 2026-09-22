# 30: Rich text editor — image caption, alt text, editing, and tooltips

Status: in-progress
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

- [ ] Seam A: a stored document with `credit` parses to `caption`; one with `caption` and `alt` parses unchanged; the renderer emits `alt` and omits `<figcaption>` for an empty caption; unit tests cover all three.
- [ ] The seed command runs against the converted documents and the case-3 runner shows captions where credits were.
- [ ] Inserting an image requires alt text; a selected image shows a ring and "Edit image" / "Remove"; editing the caption and alt updates the rendered figure in the preview and the runner after publish.
- [ ] Hovering or focusing each toolbar button shows its tooltip with the platform's shortcut where one exists.
- [ ] `pnpm test:e2e` passes once in full at the end.

Verification and evidence follow `docs/agents/testing.md` ("Proportional verification", `contract`): commit only the screenshot directories of the specs this ticket names plus `ac-1-contract.txt`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`. Origin: Paul's staging regression notes, 2026-09-21, items 13–17.

## Comments

### [EXECUTION PLAN] 2026-09-22 — Claude Fable 5.1 (`/implement`, Route: contract)

Direct checkout on `feat/30-rich-text-images-and-tooltips` from `staging` at e94c15b; one session, no worktrees.

1. **Seam A, test-first.** `src/lib/graph/content.ts`: image attrs become `src`, `alt` (string, default `""`), `caption` (string, default `""`); `contentSchema` reads a stored `credit` as `caption` when `caption` is absent; `sanitizeContent` no longer refuses anything for an image (the `SanitizeRefused` path goes). `src/lib/rich-text/extensions.ts`: `CaptionedImage` renders `<img alt>` and a `<figcaption>` only for a non-empty caption. Unit tests in `content.test.ts` and `runner/rich-text.test.tsx` cover the compatibility read, the unchanged parse, and both render shapes. A pure `src/lib/rich-text/shortcuts.ts` formats Tiptap key names for macOS and elsewhere, test-first.
2. **Seeds.** Textual rewrite of the three documents under `scripts/seed/journey-stories/` (`"credit":` → `"caption":`, `"alt": null` → `"alt": ""`), preserving every `\u` escape; the seed command's output is unchanged.
3. **Editor.** The image dialog gains Alt text (required, with its help line) and Caption (optional), opens pre-filled from a selected image, and updates the node's attrs on save; a selected image shows a focus ring and a Tiptap `BubbleMenu` with "Edit image" and "Remove"; every toolbar button gets a shadcn `Tooltip` (`src/components/ui/tooltip.tsx`, vendored from the CLI, stray `cn` package removed) reading its name and platform shortcut; Link gains a `Mod-k` binding inside the editor so the tooltip's ⌘K is true (the window-level Find-step shortcut already yields to a prevented press).
4. **Docs and specs.** `CONTEXT.md` (Caption, Alt text), README, ADR-0001's sanitizer sentence, ticket 15's contract-gaps note; `step-editing-image-credit-and-preview` becomes `step-editing-image-caption-alt-and-preview` (required alt, ring and toolbar, caption edit, runner reads alt and caption, Bold tooltip on hover); the tracked evidence directory moves with it.
5. **Verification.** `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` (via the e2e build), `E2E_EVIDENCE=step-editing-image-caption-alt-and-preview,runner-case-3-on-a-phone pnpm test:e2e` once at the end; `ac-1-contract.txt` and `dod-1-commands.txt` captured; two reviewers (correctness and contract) via `/code-review`; PR to `staging`.
