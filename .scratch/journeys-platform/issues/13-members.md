# 13: Members

Status: ready-for-agent
Blocked by: 02
Owner:
Parent: `.scratch/journeys-platform/spec.md`

**What to build:** A Member adds another Author to a Project by the email of an existing account, sees the Member list, and removes a Member. All Members are equal. The last Member cannot be removed. No invitation emails, no pending state, no roles.

- [ ] Add by email succeeds for an existing account and fails clearly for an unknown email.
- [ ] Added Member sees the Project in their list and can edit its Journeys.
- [ ] Remove works; removing the last Member is refused.
- [ ] Seam B: two minted Authors — one adds the other, the other opens the Project.

Verification and evidence follow `docs/agents/testing.md`: cite the exact commands run; commit any artifact used as PASS evidence under `test-results/`; never include participant Responses or real run data. Use `CONTEXT.md` vocabulary. Spec: `.scratch/journeys-platform/spec.md`.

## Comments
