// splitpanes ships JS-only — type shim (lezer-zen precedent), sized to the
// props the port actually binds.
declare module 'splitpanes' {
  import type { DefineComponent } from 'vue';

  export const Splitpanes: DefineComponent<{
    horizontal?: boolean;
    pushOtherPanes?: boolean;
    dblClickSplitter?: boolean;
    firstSplitter?: boolean;
    lastSplitter?: boolean;
  }>;

  export const Splitpane: DefineComponent<{
    size?: number;
    minSize?: number;
    maxSize?: number;
  }>;
}
