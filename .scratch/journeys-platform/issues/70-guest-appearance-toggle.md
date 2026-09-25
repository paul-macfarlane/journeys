# 70: A guest can choose light or dark

Status: in-progress
Blocked by:
Owner: Claude (Opus 5.5), 2026-09-25
Parent: `.scratch/journeys-platform/spec.md`
Priority: post-hackathon polish (Paul, 2026-09-25: "Write up the ticket and use /implement"; judges are evaluating production, so this lands on `staging` only and Paul promotes it later).
Route: polish

**Why:** the app follows the operating system's scheme (`next-themes`, `defaultTheme="system"` in `src/components/theme-provider.tsx`), and the only way to override it is the Theme row in the signed-in account menu (`src/components/navbar/user-menu.tsx`, ticket 51). A guest — a Participant on the runner, or a visitor on the splash page, the guide, About, or the legal pages — cannot pick light or dark at all: someone reading a long Journey at night on a device set to light has no way to switch. A production check on 2026-09-25 confirmed every splash asset has both schemes and swaps on the `.dark` class, so a guest control needs no new recordings or stills.

**What to do:** the smallest change that fits the existing footer.

1. `SiteFooter` (`src/components/site-footer.tsx`), the one footer every page renders — the splash page, sign-in, the prose pages, every Author page, and the runner frame (live, Preview, and the public Project page) — gains a Light / Dark / System control at the end of its links group. It is the same `SegmentedControl` (`src/components/ui/segmented-control.tsx`) with the same three icon segments the account menu uses, so both drive the same `next-themes` choice (stored in the browser, falling back to the system) and always agree. It appears on Author pages too, so the footer stays one footer everywhere (ticket 34); the account menu row stays as it is.
2. Its accessible name is **"Appearance"**, not "Theme": in this app a Theme is the runner's preset and accent (`CONTEXT.md`), and the runner footer sits inside a themed frame, so "Theme" would name the wrong thing. It also keeps the existing `radiogroup` "Theme" locators in the account menu unambiguous.
3. The control is a small client island. The footer stays a server component; the runner already hydrates under the root layout's `ThemeProvider`, so the island adds no new provider. `next-themes` has no answer during server rendering, so the island reads it only after hydration (a mounted flag from `useSyncExternalStore`, which the lint rules prefer over set-state-in-effect), showing System checked until then. That avoids an `aria-checked` hydration mismatch, which React never repairs.
4. The shared list of the three choices and the `isTheme` guard move out of `user-menu.tsx` into the new component's module so the two controls cannot drift.
5. Layout: at 1280 px the footer stays on one row (ticket 62); at 375 px the mark and copyright stay on the first row and the links on the second, with the control free to wrap below them at the same left edge (ticket 67). Inside the runner the control takes the frame's tokens (`bg-secondary`, `primary` for the checked segment), so it reads in every preset and both schemes.

Out of scope: the `themeColor` meta in `src/app/layout.tsx` follows the operating system, so a guest who picks dark on a light OS keeps a light browser toolbar (cosmetic; `next-themes` does not rewrite it). No re-recording of `public/demo/`.

Acceptance criteria:

- [ ] A guest with a light OS scheme opens the splash page, presses Dark in the footer's "Appearance" control, and the page turns dark (`<html>` carries `dark`) with the dark recording showing in place of the light one; the choice survives a reload and carries to a live runner Step, whose footer shows Dark checked; System returns to the OS scheme (`e2e/footer.spec.ts`, `guest-appearance`, one screenshot of the splash page in dark).
- [ ] The account menu's Theme row and the footer control agree: `navbar.spec.ts`, `canvas.spec.ts`, and `themes.spec.ts` pass unchanged.
- [ ] The footer layout specs pass unchanged: `footer-wrap` at 375 px, and the one-row footer checks in `about.spec.ts`, `guide.spec.ts`, and `landing.spec.ts`.

Verification follows `docs/agents/testing.md`, polish route: `pnpm lint`, `pnpm typecheck`, `pnpm test`, one full `pnpm test:e2e` at the end with `E2E_EVIDENCE=guest-appearance`; evidence is `test-results/dod-1-commands.txt` and `test-results/guest-appearance/`. One AI reviewer. No production deploy: the PR targets `staging`, and Paul promotes after judging.

## Comments
