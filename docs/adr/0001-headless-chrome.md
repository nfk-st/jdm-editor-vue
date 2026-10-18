# Headless chrome (Reka UI) instead of ant-design-vue

Upstream `@gorules/jdm-editor` builds its UI on antd 5 (imported in 58 of 90 TSX files). We are rebuilding that chrome on headless primitives (Reka UI, formerly Radix Vue) with our own SCSS + CSS-custom-property design-token layer, trading visual parity and porting speed for zero antd dependency, a small bundle, and full control of the look.

## Consequences

- Every upstream view file that touches antd will diverge structurally; upstream UI fixes will not cherry-pick cleanly. Logic files (stores, hooks, utils, specifications) are unaffected — see ADR-0002.
- We owe ourselves a token layer that approximates the upstream look at ship time, so the editor remains recognisable to GoRules users.
