// Type shims for the @gorules lezer grammar packages — they publish JS only
// (dist/index.js, no .d.ts), so TS7016 fires on `import { parser }`.
// Same practice as upstream's local shims for untyped JS dependencies
// (components/function/helpers/http.d.ts et al).
// PORTING: new file (no upstream counterpart at this location) — upstream
// avoids the error via workspace resolution, not via shipped types.

declare module '@gorules/lezer-zen' {
  import type { LRParser } from '@lezer/lr';

  export const parser: LRParser;
}

declare module '@gorules/lezer-zen-template' {
  import type { LRParser } from '@lezer/lr';

  export const parser: LRParser;
}
