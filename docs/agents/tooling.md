<!-- atlas-v3:tooling:start -->
# Repository tooling and plugin capabilities

This document is the authoritative registry of repository capability status and
usage constraints. A listed capability is not blanket permission and never
overrides repository policy, approvals, or guardrails.

Read this guide before work that depends on a cloud provider, infrastructure
tool, language server, browser driver, source host, tracker, or current
third-party library documentation.

| Plugin | Status | Why it applies | Use when | Prerequisites | Install or state |
|---|---|---|---|---|---|
| `context7` | installed | Next.js 16, Drizzle, better-auth, React Flow, and Tiptap are version-sensitive dependencies. | Checking current, version-specific library behavior before planning or implementing against it. | none | active |
| `vercel` | installed | Vercel is the deployment target. | Reading deployment, staging domain, and runtime log state. Mutating operations stay denied by the guard; deploys happen via git push. | none | active |
| `playwright` | installed | Playwright e2e suite exists in `e2e/`; the plugin was installed at user scope on 2026-09-19. `pnpm test:e2e` works without it. | Driving ad-hoc browser checks or capturing extra UI evidence outside the committed e2e suite. | none | active |
| `typescript-lsp` | installed | TypeScript is the confirmed stack; `typescript-language-server` 6.0.0 is on PATH and the plugin was installed at user scope on 2026-09-19. | Navigating and editing TypeScript with language-server diagnostics. | typescript-language-server | active |
| `github` | recommended | The repository remote is hosted on GitHub; the `gh` CLI already covers PR creation and a GitHub MCP connector is configured but unauthorized. | Only if issue or PR reads via MCP are wanted; requires OAuth in an interactive session. | none | `/plugin install github@claude-plugins-official` |
| `pyright-lsp` | declined | Python was detected only from Atlas's own guard hooks, not project code. | — | pyright-langserver | `/plugin install pyright-lsp@claude-plugins-official` |

`installed` means setup verified the plugin is enabled and any named binary is
available. `recommended` means the repository signals match but installation
still needs human approval. `declined` and `unavailable` are explicit outcomes,
not permission to pretend the capability exists.

Use Context7 when it is installed and a plan or implementation relies on
version-specific external library or framework behavior. Otherwise consult the
primary official documentation and record the source and version used.

Use language-server plugins during code navigation and editing; they supplement
rather than replace the repository's lint, typecheck, and test commands. Use
browser plugins only when a UI or browser run surface exists. Provider, source-
host, tracker, and browser plugins never override Atlas guardrails, repository
permissions, approval policy, or human-only actions.
<!-- atlas-v3:tooling:end -->
