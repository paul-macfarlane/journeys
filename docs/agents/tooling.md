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
| `vercel` | installed | Vercel is the deployment target. | Reading deployment, preview URL, and runtime log state. Mutating operations stay denied by the guard; deploys happen via git push. | none | active |
| `playwright` | recommended | Installed in the plugin cache but not enabled; e2e is in scope once a UI exists. | Driving the demo-path e2e flow after the participant runner exists. Enable the plugin first. | none | `/plugin install playwright@claude-plugins-official` |
| `github` | recommended | The repository remote is hosted on GitHub; `gh` CLI already covers PR creation. | Only if issue or PR reads via MCP are wanted; requires OAuth in an interactive session. | none | `/plugin install github@claude-plugins-official` |
| `typescript-lsp` | recommended | TypeScript is the confirmed stack; a prior install attempt did not register. | Navigating and editing TypeScript with language-server diagnostics. | typescript-language-server | `/plugin install typescript-lsp@claude-plugins-official` |
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
