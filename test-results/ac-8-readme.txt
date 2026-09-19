# AC-8 — README contents
commit: 88a9f1f  date: 2026-09-19T18:25:11Z
$ grep -n -i -E "^# Journeys|^## Local setup|^## Commands|^## Environments|^## End-to-end tests|atlas-operators-guide.md|pnpm db:up|5436|Prerequisites" README.md
1:# Journeys
16:## Local setup
18:Prerequisites: Node 22 or newer, pnpm 10 (`corepack enable` picks up the
24:pnpm db:up                    # Docker Postgres 18 on localhost:5436
35:[`.scratch/journeys-platform/human-prerequisites.md`](.scratch/journeys-platform/human-prerequisites.md).
38:## Commands
49:| `pnpm db:up` / `db:down`          | Start / stop local Postgres (host port 5436)   |
55:## Environments
76:## End-to-end tests
109:[`docs/atlas-operators-guide.md`](docs/atlas-operators-guide.md).
$ ls docs/atlas-operators-guide.md
docs/atlas-operators-guide.md
$ grep -c "docs/adr/" README.md (dead link removed; expect 0 link syntax)
0
