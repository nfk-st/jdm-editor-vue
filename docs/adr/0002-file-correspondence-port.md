# File-correspondence port from a pinned upstream commit

This library is a Vue 3 port of GoRules' React `@gorules/jdm-editor`, starting from upstream master `283bb11da324e0aaa641c790de9dd888ea2d2832` (2026-05-13). We keep upstream's module boundaries, file names, and store shape 1:1 — stores become composables over `ref`/`computed` via provide/inject, React contexts become providers — so future upstream fixes to logic can be diffed and cherry-picked into this repo. Views diverge by design (ADR-0001).

## Consequences

- Structural renames "for Vue idioms" are rejected even when tempting; correspondence wins.
- The pin commit must be recorded (PORTING.md) and advanced deliberately, never by silent rebase.
