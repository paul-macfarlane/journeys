# 73: Stale saves are refused, never silently overwritten

Status: ready-for-agent
Blocked by: 72
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon order (Paul, 2026-09-26): 71 → 72 → **73** → 74 → 75 → 76 → 77 → 42 → 78 → 79 → 53 → 57 → 80; parked 44, 39, 45.
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
