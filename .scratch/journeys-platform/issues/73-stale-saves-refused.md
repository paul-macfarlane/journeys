# 73: Stale saves are refused, never silently overwritten

Status: done
Blocked by: 72, 81
Owner: Claude Opus 5.5 (chunk 1, `feat/chunk-1-saves-and-unreadable-rows`)
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: contract (schema and every write path)

**Why:** ticket 15 ("Concurrent Draft writes", "Metadata forms, last write wins", "Corrupt-row handling"). `saveDraft` is whole-document and last-write-wins (ADR-0001, "Writes are whole-document"), and so are the Project and Journey settings forms. Two Members editing at once overwrite each other with no warning: silent data loss.

**Decisions (Paul, 2026-09-26, Q11):** a stale save is refused, never merged. The Member whose save is refused is told that another Member changed it and reloads to see the change; nothing is overwritten. No presence indicator, no soft lock, no real-time editing. The same rule covers the Draft, Project settings, and Journey settings.

**What to build (the mechanism follows 72's recommendation; the default is below):**

- A version counter on each row that can be edited concurrently (`draft`, `project`, `journey`) as an additive migration with a default, so the code already deployed keeps working while Migrate runs. Each read returns the counter; each write sends back what it read and updates only when the counter still matches, incrementing it. A mismatch returns a `stale` result.
- The autosave loop treats `stale` as terminal: it stops saving, keeps the Member's unsaved edit on screen, and shows "Someone else changed this [Draft/Project/Journey] since you opened it. Reload to see their changes." with a Reload button. There is no automatic retry or merge. Undo history is left alone until the Member reloads.
- Restore and publish take the same check where they write the Draft.
- **Corrupt rows** (agent recommendation, Q5): `getDraftForMember` throwing on a row that fails the schema becomes a page that names the Journey and says its Draft cannot be read. When a Published Version exists it offers "Restore from Version N"; otherwise it says what happened. It is never a 500.

Acceptance criteria:

- [ ] Two browser contexts open the same Draft; A saves; B's next save is refused with the message and B's edit stays visible; after Reload, B sees A's change (e2e, `draft-stale-save`).
- [ ] The same for a Project title edited in two contexts (e2e, `settings-stale-save`).
- [ ] A single Member editing alone never sees the message, including across rapid autosaves and undo/redo (the existing autosave and undo specs pass unchanged).
- [ ] A Draft row that fails the schema renders the recovery page, and Restore works from it (unit plus one e2e seeded with a bad row).
- [ ] Ticket 15's three bullets are closed.

Verification follows `docs/agents/testing.md` (`contract`), including `pnpm db:migrate` and proof that the migration works against the previous code. Never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Origin: ticket 15; Paul's post-hackathon grilling, 2026-09-26.

## Comments

### 2026-09-26: design to follow (ticket 72)

Ticket 72 reviewed the write path. Follow this design; each point cites 72's findings.

**Blocked by 81** (added by 72; the order itself is Paul's to approve). The Draft editor runs its own copy of the autosave loop (`draft-editor.tsx:155-375`). Ticket 81 moves it onto `createAutosave` and widens `write` to `write(value, baseline) → saved | refused`. After that, this ticket adds `stale` in one place.

**1. The check lives at two seams, each written once.**

- **The data layer.** One helper in `src/db` performs a conditional write with a guard and `RETURNING`. It returns `{ ok: true, row }`, or `{ ok: false, reason: "stale" }`.
  - For `project` and `journey` rows it is `UPDATE … WHERE id = $id AND <guard>`.
  - For the Draft it keeps today's upsert, with the guard on the conflict branch: `INSERT … ON CONFLICT (journey_id) DO UPDATE SET … WHERE draft.version = $expected`. A missing Draft row is still created, as `saveDraft` and `restoreVersion` intend (`drafts.ts:110`, `versions.ts:273`).
  - Zero rows returned is ambiguous: the guard failed, or the row went away (a Journey deleted between the membership check and the write). Before answering `stale`, the helper re-reads the row's existence and answers `not-found` if it is gone. Every guarded write goes through it: `saveDraft`, `restoreVersion`, `updateProjectForMember` (title, description, and theme already share it), and a new `updateJourneyForMember` that `updateJourney` and `setJourneyTheme` both use.
- **The loop.** `createAutosave` gains a terminal `stale` status: `STATUS_TEXT` holds the message, and the Reload button sits beside it.
  - Once stale, `change` still updates the value on screen, but nothing schedules a write.
  - `flush` and `dispose` do nothing.
  - `unload` writes nothing but still returns true, so the browser asks before leaving.
  - `useAutosavedForm` maps a stale result to this state, not to a field error.

**2. The guard is not the same for every row, because one counter per row makes a Member conflict with themselves (72 finding W3).**

- The Project Settings tab runs three independent loops on one `project` row: the title form, the description loop, and the Theme form (`project-settings-fields.tsx:42, 60`, `project-theme-settings.tsx:36`).
- The `journey` row is written by the title form, the Theme checkbox, the Theme fields, publish, unpublish, and move.
- With one `version` column per row, a Member's own title save would make their own description save stale. So would a publish followed by a title edit.
- **Recommended:**
  - **Draft: an integer `version` column** on `draft`. The additive migration defaults it to 0; the deployed code never reads it. The editor is the Draft's only autosaving writer.
    - The loop's `T` is `{ document, version }`, and `equals` compares documents only.
    - `write` sends `baseline.version` as the guard and returns `saved: { document, version: new }`.
    - `restoreVersion` takes the version the Versions tab read.
    - Publish takes the version the Member holds and refuses a stale one (see 4).
  - **Settings: compare the previous value, per field.** The guard is `WHERE title IS NOT DISTINCT FROM $baseline.title AND …`, over exactly the fields that write changes. The baseline is the loop's `lastSaved`, which `write(value, baseline)` already receives after 81.
    - Each loop guards only its own fields, so the three Project loops, the Theme checkbox, and publish/unpublish/move never make each other stale.
    - No new columns on `project` or `journey`.
    - The fields are small (title, a short description, the Content description, two Theme values), so sending the baseline costs nothing.
  - The Draft keeps a counter rather than a compared value, because the document can be large and sending it twice per save doubles the payload.
- Record the choice in an ADR amendment to ADR-0001, "Writes are whole-document".

**3. `adopt` must not move the baseline under an edit (72 finding W4).** Today `adopt(incoming)` with an edit in hand makes `incoming` the new `lastSaved` (`src/lib/autosave.ts:176-180`). `useAutosavedForm` merges per field: untouched fields take the incoming value, and edited fields keep the Author's edit (`src/components/autosaved-form.ts:151-157`). Under either guard, the next write would then match the other Member's value and overwrite it silently, which is exactly what this ticket exists to stop. The rules:

- **Settings.** The baseline merges per field, the same way the value does:
  - An untouched field adopts the incoming value, for both value and baseline.
  - An edited field keeps its old baseline, so its write goes stale if someone else changed that field.
  - A write sends and guards only the fields where value and baseline differ, so an untouched field is never overwritten or checked.
  - `adopt(incoming, keep)`'s `keep` returns both halves, `{ value, baseline }`. `useAutosavedForm`'s merge fills both from the same per-field rule, and the loop stays ignorant of fields. Test it: a dirty loop adopts another Member's change to the same field, then writes, and gets `stale`. Adopting a change to a different field and then writing gets `saved`.
- **Draft.** It already adopts only when nothing is unsaved (`draft-editor.tsx:314-326`); keep that. A dirty editor keeps its old `version`, so its write goes stale.

**3a. The baseline must be what the server stored, not what the client sent.** Titles are trimmed (`src/lib/validation/project.ts:17`, `journey.ts:13, 24`), and Content and documents are sanitised on write. If `lastSaved` held the client's untrimmed value, the next guard would compare against a value the database never held, and every second save would go stale. So every guarded write returns the stored values, and the loop takes them as `lastSaved` (81's `saved`).

**3b. Restore and the open editor.** Restore runs from the Versions tab, and opening that tab unmounts the editor. The editor's unmount save runs first and refreshes the page when it lands, so no open editor ever holds a Draft version older than the restore. The restore dialog sends the Draft version from the latest render. If that render predates the unmount save landing, the restore is refused as stale and the Member reloads. That refusal is conservative but safe, and it cannot lose an edit. Returning to the Draft tab remounts the editor with the restored document and its new version.

**3c. What a value compare cannot see.** A field changed A → B → A by someone else passes the guard, because the value is what it was when the edit began. For a title or a Theme that is the right answer, since nothing the Member overwrites differs from what they saw. Say so in the ADR amendment.

**4. Publish reads the Draft outside its transaction (72 finding W2).** `publishDraft` reads the Journey and the Draft before `db.transaction` (`src/db/versions.ts:153-158`), so a save landing in between publishes the older document. Move both reads inside the transaction, lock the Draft row (`SELECT … FOR SHARE`), and compare its `version` with the one the Member sent.

**5. Corrupt Draft rows.** Give `getDraftForMember` a `safeParse` and a result of `{ kind: "ok", … } | { kind: "unreadable", version, updatedAt } | null`. The Journey page renders the recovery page on `unreadable`, and publish refuses it. Ticket 83 takes the other stored documents and adds the app's `error.tsx`, which does not exist yet.

**6. Result shape.** Add `stale` to the data-layer failure union that ticket 82 standardises. If 82 has not landed, add it as `{ ok: false, reason: "stale" }` so 82 can fold the rest in around it.

**7. Writes outside the loop.** These use the same helper and the same compare-previous-value guard, not a third mechanism. The Journey's "Use the Project's Theme" checkbox writes the `journey` row through `useOptimistic`, beside the Theme fields' own loop (`journey-theme-settings.tsx:40-61`). It sends the preset it replaced as its guard, and a stale answer shows the same message. Account settings (`author-settings.tsx`) edit the Author's own row, not a shared one, so they stay out of scope.

### [EXECUTION PLAN] 2026-09-26 — Claude Opus 5.5 (`/atlas-implement`, chunk 1, Route: contract)

Chunk 1 ("Saves and unreadable rows": 81 → 73 → 83) is one work package on `feat/chunk-1-saves-and-unreadable-rows` (off `origin/staging` at `ebb8178`), one PR to `staging`, in the worktree `.claude/worktrees/chunk-1-saves/journeys` with a dummy env (never `.env.local`), e2e on port 3181 against `journeys_e2e_c1`. Three sequential deliverables, one worker each: D1 = ticket 81 (opus), D2 = this ticket (opus), D3 = ticket 83 (sonnet). Sequential because D2 and D3 both edit `src/db/versions.ts`, `src/db/projects.ts`, the Journey page, and `e2e/setup/documents.ts`, and 83 reuses this ticket's "cannot be read" notice; D1 could run beside D3 but two `next build` + Playwright runs on one Mac fail unrelated specs.

**Resolved decisions (this ticket's 2026-09-26 design comment is followed as written; these fill its gaps).**

- Migration `drizzle/0011_draft_version.sql`: `ALTER TABLE "draft" ADD COLUMN "version" integer DEFAULT 0 NOT NULL`. Proof against the previous code: after `pnpm db:migrate`, the exact upsert the deployed `saveDraft` issues (no `version` column) is run against the migrated database and succeeds — captured to `test-results/73-ac-migration.txt`.
- The data-layer helper is `guardedWrite` in `src/db/guarded-write.ts`: it takes the guarded statement (returning rows) and an existence re-read, and answers `{ ok: true, row } | { ok: false, reason: "stale" } | { ok: false, reason: "not-found" }`. Every guarded write (`saveDraft`, `restoreVersion`, `publishDraft`'s check, `updateProjectForMember`, the new `updateJourneyForMember`) goes through it. Ticket 82 has not landed, so `stale` is added as `{ ok: false, reason: "stale" }`.
- Loop: `SaveStatus` gains terminal `stale`; the write result gains `{ kind: "stale" }`. `STATUS_TEXT.stale` is the generic sentence and `staleText(noun)` names the surface ("Someone else changed this draft since you opened it. Reload to see their changes."). The Reload button is `useAutosave`'s `reload()`: it detaches the loop's `beforeunload` guard, then `window.location.reload()`, so the Member who chose Reload is not asked again; an accidental navigation while stale is still asked (`unload()` writes nothing, returns true).
- Settings guards compare previous values per field through `IS NOT DISTINCT FROM` (jsonb for the Content description); the action receives `(id, next, baseline)`, runs both through the same schema, and sends only fields whose stored value differs. The Theme checkbox sends the preset it replaced.
- Corrupt Draft: `getDraftForMember` answers `{ kind: "ok", document, version, updatedAt } | { kind: "unreadable", version, updatedAt } | null`. The Journey page keeps its header and tabs; the Editor tab shows the shared `CannotBeRead` notice (`src/components/cannot-be-read.tsx`, which 83 reuses) naming the Journey, with "Restore from Version N" (newest Published Version, through `RestoreVersionDialog` carrying the unreadable row's version) or, with none, what happened. Publish refuses an unreadable Draft server-side.
- e2e helpers: `writeRawDraftRow(journeyId, json, version?)` in `e2e/setup/documents.ts` seeds the bad row.

**Verification map** (`docs/agents/testing.md`, contract; the chain runs once at the chunk's end):

| Criterion | Proof | Evidence | Earliest |
|---|---|---|---|
| AC1 two contexts, Draft; refusal, edit kept, Reload shows A's change | e2e `draft-stale-save` | `test-results/draft-stale-save/` | after D2 |
| AC2 Project title in two contexts | e2e `settings-stale-save` | `test-results/settings-stale-save/` | after D2 |
| AC3 a lone Member never sees it | existing autosave/undo specs unchanged in the full run; loop unit tests | `test-results/chunk-1-commands.txt` | end of chunk |
| AC4 corrupt Draft row → recovery page, Restore works | unit (`drafts` result mapping) + e2e `draft-unreadable` seeded with a bad row | `test-results/draft-unreadable/`, unit line in commands | after D2 |
| AC5 ticket 15's three bullets closed | static read of `15-post-hackathon-hardening.md` | `test-results/73-ac-5-ticket-15.txt` | after D2 |
| Migration works with the previous code | `pnpm db:migrate` + old upsert against the migrated database | `test-results/73-ac-migration.txt` | after D2 |
| ADR-0001 amended | `docs/adr/0001-*.md` amendment section | in the diff | after D2 |
| Chain | `pnpm format:check; pnpm lint; pnpm typecheck; pnpm test; pnpm db:migrate; E2E_EVIDENCE=draft-stale-save,settings-stale-save,draft-unreadable,unreadable-version pnpm test:e2e` | `test-results/chunk-1-commands.txt` | end of chunk |

Human gates: none before dispatch. Announced for later: Paul merges the PR (Migrate runs on `staging`), runs `pnpm db:migrate` on his dev database, and smokes staging.

### [AI CODE REVIEW] 2026-09-26 — two readers (correctness and spec; coding standards), diff `ebb8178...b72a3de`, judged by the orchestrator

*Correctness and spec:*

- **Blocking, fixed in 5adb888.** A lone Member clicking Publish straight after typing was refused as stale. The blur started a save at version N, publish sent N, and the save committed N+1 first. Publish and Restore now await the open editor's flush, through the new `draft-version.tsx` scope, and then read the held version from a ref. The new e2e `draft-publish-right-after-edit` proves it; a red run was confirmed first.
- **Non-blocking, all fixed in 5adb888:**
  - An adopt during an in-flight write was undone when the write landed. A per-field `rebase` now keeps the adopted baseline for fields the write did not change.
  - A retired Theme preset went stale forever. The preset guard now also passes when the stored preset is no longer valid.
  - An unreadable Project description went stale on every edit. The description guard is skipped when the stored value fails the contract, and this is logged.
  - The Journey Theme checkbox guarded with a prop older than the Member's own Theme save. It now holds the last acknowledged override.
  - The Project description loop never adopted. It now adopts when clean, and e29037d resets the editor so the screen shows the adopted baseline; without that, the next edit could have overwritten another Member's change.
  - The Draft version schema had no upper bound. It is now capped at the int4 maximum.
- **Rejected:** returning the stored Draft document as `saved`. The guard is the counter, and adoption behaves as before.

*Standards:*

- **Fixed in 5adb888:**
  - "unreadable" is now `reason: "unreadable"`, like `stale`.
  - A shared `rowExists`.
  - The draft-version context moved out of `publish-controls.tsx`.
  - `keepEditedFields` now documents that it compares with `===`.
  - Comment and header corrections.
  - The `stale: undefined` placeholder is gone.
- **Rejected:** importing `emptyContent` into `schema.ts`. It keeps its literal default and imports only types from `src/lib`.

Conformity: every AC and design point (1–7, 3a–3c) is met after the fixes. Approved deviations:
- `PublishScope` carries the Draft version the Member holds.
- The editor ignores renders older than its stored version.
- `useAutosavedForm`'s `noun` is optional, because Account settings cannot go stale.
- The preview redirects on an unreadable Draft.
- A stale publish shows the sentence as text.
- `ActionResult` failures carry `stale?: true`, with the sentence as `error`.

### [CLOSEOUT] 2026-09-26 — Claude Opus 5.5 (`/atlas-implement`, chunk 1, Route: contract)

PR: https://github.com/paul-macfarlane/journeys/pull/101 (base `staging`, comparison SHA `ebb8178`), shared with 81 and 83. Status set to `done` in this commit; merging the PR is Paul's acceptance. State log: ready-for-agent → in-progress → ai-review → ready-for-human → done (this commit). The backlog's "Blocked by 81" note is dropped because 81 closed on this branch.

**Deliverables.**
- D2, worker (opus): 95c5435.
- F1 review fixes, worker (opus): 5adb888.
- Orchestrator fix: e29037d, the description editor reset.

**Seams.**
- `src/db/guarded-write.ts`: `guardedWrite`, `changedFields`, `stillHolds`, `stillHoldsOrRetired`, `rowExists`.
- The loop's terminal `stale`, a per-field `keep`/`rebase`, and `current` following a `saved` value.
- `StaleNotice` with Reload, which skips the unload prompt.
- `getDraftForMember` → `ok | unreadable | null`, with the `CannotBeRead` notice.

| Criterion | Verdict | Evidence |
|---|---|---|
| Two contexts on one Draft: A saves; B's next save is refused with the message and B's edit stays; after Reload B sees A's change | PASS | `test-results/draft-stale-save/draft-stale-save.png` (viewed), e2e `draft-stale-save` |
| The same for a Project title | PASS | `test-results/settings-stale-save/settings-stale-save.png` (viewed) |
| A Member editing alone never sees the message, including rapid autosaves and undo/redo | PASS | full e2e 120/120 with every existing autosave and undo spec unchanged, plus `draft-publish-right-after-edit`; `test-results/chunk-1-commands.txt` |
| A Draft row that fails the schema renders the recovery page, and Restore works from it | PASS | `src/db/drafts.test.ts`; e2e `draft-unreadable` (status 200, restore, row equals Version 1 at version 3→4); `test-results/draft-unreadable/draft-unreadable.png` (viewed) |
| Ticket 15's three bullets are closed | PASS | `test-results/73-ac-5-ticket-15.txt` |
| `pnpm db:migrate` and proof against the previous code | PASS | `test-results/73-ac-migration.txt`; chain `db:migrate` exit 0 |
| ADR-0001 amendment | PASS | `docs/adr/0001-graph-as-one-json-document.md` |

**Verified run command.** Commit e29037d: format:check, lint, typecheck, unit 616/616, `db:migrate`, `E2E_EVIDENCE=draft-stale-save,settings-stale-save,draft-unreadable,unreadable-version pnpm test:e2e` 120/120 with 0 flaky; every step `exit=0`.

**Deploy window (for Paul).** Saves from the previously deployed build do not bump `draft.version`. For the minutes the old and new builds overlap, an old-build save cannot make a new-build save stale. After that, every write is guarded.

**Remaining risk.** A value compare cannot see A → B → A, which the ADR amendment records. No e2e covers two Members editing the Project description (rich text); the reset is unit-reasoned and covered only by the Settings specs passing.

**Paul owes.** Merge #101; run `pnpm db:migrate` on the dev database; smoke staging: two tabs on one Draft, and Publish right after typing.
