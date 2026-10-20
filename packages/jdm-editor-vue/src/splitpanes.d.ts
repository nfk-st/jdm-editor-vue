// splitpanes ships JS-only — type shim (lezer-zen precedent), sized to the
// props the port actually binds.
//
// PORTING(fix): the shim previously declared a `Splitpane` export that the
// package does NOT have — splitpanes v3 exports exactly `Splitpanes` and
// `Pane` (node_modules/splitpanes/src/components/splitpanes/index.js). The
// phantom export type-checked but threw a SyntaxError at runtime ("does not
// provide an export named 'Splitpane'"), which killed the whole app on load
// in a real bundler. The shim now mirrors the package's real surface.
declare module 'splitpanes' {
  import type { DefineComponent } from 'vue';

  export const Splitpanes: DefineComponent<{
    horizontal?: boolean;
    pushOtherPanes?: boolean;
    dblClickSplitter?: boolean;
    rtl?: boolean;
    firstSplitter?: boolean;
  }>;

  // upstream's react-resizable-panels <Panel> → splitpanes' <Pane>
  export const Pane: DefineComponent<{
    size?: number | string;
    minSize?: number | string;
    maxSize?: number | string;
  }>;
}
