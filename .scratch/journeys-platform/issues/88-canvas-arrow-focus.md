# 88: Canvas arrows: keyboard focus and order

Status: needs-triage
Blocked by: None
Owner:
Parent: `.scratch/journeys-platform/spec.md`
Priority: see `.scratch/journeys-platform/backlog.md`.
Route: polish

**Why:** ticket 78's accessibility walk (chunk 5, 2026-09-27). On the Journey page's canvas, the arrows (`g[role=group]`, named "<Choice>: <Step> → <Step>") are tab stops that come before every Step box, because React Flow renders its edge layer first. A focused arrow shows no outline or ring, and Enter on a focused arrow drops focus to `body`.

**What "fixed" means:**

- Arrows are reached after or with their source Step, or are not tab stops at all (React Flow's `edgesFocusable`), with selection still possible from the Step panel's Choices.
- A focused arrow shows a visible focus indicator in both schemes.
- Enter on a focused arrow keeps focus on it or moves it somewhere meaningful (the Choice in the Step panel).

Acceptance: an e2e test tabs through a two-Step map and asserts the order and a visible focus on an arrow; Enter keeps focus off `body`.
