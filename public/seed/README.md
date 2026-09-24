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
