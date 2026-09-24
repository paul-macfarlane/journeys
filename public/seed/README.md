# Seed images

Images the seed documents point at. They are committed here and linked at
their raw GitHub address on `staging`
(`raw.githubusercontent.com`, then the repository, the branch `staging`, and
`public/seed/<file>`; the seed document spells it with `\u002f` escapes so no
40-character run trips the commit-time secret scrub),
because stored rich text keeps only absolute http(s) image URLs and the app's
own origin differs per environment. The recording script serves the committed
file for that address itself, so nothing here needs the network to record.

- `allotment.jpg` — the one image in the demo Journey `A key on the doormat`
  (`scripts/seed/allotment/a-key-on-the-doormat.json`), rendered from
  `scripts/seed/allotment/illustration.svg`, which was drawn for this
  repository. Public domain.
- `external-fixator.jpg` — Case 1, "Wait w/ Broken Leg"
  (`scripts/seed/journey-stories/case-1.json`). "Patient with external
  fixator in the leg" by Ortopedikus on Wikimedia Commons, CC BY-SA 4.0
  (the Commons file page of that name; the Step's own credit links it),
  resized from the 4592px original to 1400px. The Commons thumbnail URL the
  document used to hotlink stopped serving (400) on 2026-09-24 (ticket 61).
- `caroline-phone.jpg` and `caroline-common-area.jpg` — Case 2, "Legal Org"
  and "Work". Two photos by Keith Gardner from the DVIDS set "Photos of ICE
  IGSA Caroline Detention Facility outside Bowling Green, VA" (2018,
  https://www.dvidshub.net/image/4695732 and
  https://www.dvidshub.net/image/4695726), public domain as US government
  works, at DVIDS's own 1000px rendition. The document used to hotlink a
  picryl.com copy of one photo from that set for both Steps; picryl's CDN
  now refuses every off-site request (403), and the exact frame it served
  could not be recovered, so each Step got the frame from the same set that
  fits its text (a phone for the call, the common area for the work day).
- `bluebonnet-cell.jpg` — Case 2, "Day 1 in Detention". Photo by Charles
  Reed from the DVIDS set "ICE Dallas office opening its newest detention
  facility in West Texas" (2019, https://www.dvidshub.net/image/5951333),
  public domain, at DVIDS's 1000px rendition; the picryl copy is 403 as
  above.

Case 1's "Years go by" image (a screenshot from a WordPress blog that now
answers 410 with no archived copy) was removed in ticket 61; its credit
line stays as a paragraph.
