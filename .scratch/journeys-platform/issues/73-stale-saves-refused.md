# 73: Stale saves are refused, never silently overwritten

Status: ready-for-agent
Blocked by: 72
Owner:
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

**Do 81 first.** The Draft editor runs its own copy of the autosave loop (`draft-editor.tsx:155-375`). Ticket 81 moves it onto `createAutosave` and widens `write` to `write(value, baseline) → saved | refused`. After that, this ticket adds `stale` in one place.

**1. The check lives at two seams, each written once.**

- **The data layer.** One helper in `src/db` performs a conditional `UPDATE … WHERE <guard> RETURNING …`. It returns `{ ok: true, row }`, or `{ ok: false, reason: "stale" }` when no row matched after the membership check passed. Every guarded write goes through it: `saveDraft`, `restoreVersion`, `updateProjectForMember` (title, description, and theme already share it), and a new `updateJourneyForMember` that `updateJourney` and `setJourneyTheme` both use.
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
  - Give `adopt` a `keepBaseline` counterpart to `keep`, or have the loop derive it (edited fields keep theirs). Test it: a dirty loop adopts another Member's change to the same field, then writes, and gets `stale`. Adopting a change to a different field and then writing gets `saved`.
- **Draft.** It already adopts only when nothing is unsaved (`draft-editor.tsx:314-326`); keep that. A dirty editor keeps its old `version`, so its write goes stale.

**3a. The baseline must be what the server stored, not what the client sent.** Titles are trimmed (`src/lib/validation/project.ts:17`, `journey.ts:13, 24`), and Content and documents are sanitised on write. If `lastSaved` held the client's untrimmed value, the next guard would compare against a value the database never held, and every second save would go stale. So every guarded write returns the stored values, and the loop takes them as `lastSaved` (81's `saved`).

**4. Publish reads the Draft outside its transaction (72 finding W2).** `publishDraft` reads the Journey and the Draft before `db.transaction` (`src/db/versions.ts:153-158`), so a save landing in between publishes the older document. Move both reads inside the transaction, lock the Draft row (`SELECT … FOR SHARE`), and compare its `version` with the one the Member sent.

**5. Corrupt Draft rows.** Give `getDraftForMember` a `safeParse` and a result of `{ kind: "ok", … } | { kind: "unreadable", version, updatedAt } | null`. The Journey page renders the recovery page on `unreadable`, and publish refuses it. Ticket 83 takes the other stored documents and adds the app's `error.tsx`, which does not exist yet.

**6. Result shape.** Add `stale` to the data-layer failure union that ticket 82 standardises. If 82 has not landed, add it as `{ ok: false, reason: "stale" }` so 82 can fold the rest in around it.

**7. Writes outside the loop.** The Journey's "Use the Project's Theme" checkbox writes the `journey` row through `useOptimistic`, beside the Theme fields' own loop (`journey-theme-settings.tsx:40-61`). It sends the preset it replaced as its guard, and a stale answer shows the same message. Account settings (`author-settings.tsx`) edit the Author's own row, not a shared one, so they stay out of scope.
