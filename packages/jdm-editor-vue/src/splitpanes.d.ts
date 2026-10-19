// splitpanes ships JS-only — type shim (lezer-zen precedent).
declare module 'splitpanes' {
  import type { DefineComponent } from 'vue';

  export const Splitpanes: DefineComponent<Record<string, unknown>>;
  export const Splitpane: DefineComponent<Record<string, unknown>>;
}
