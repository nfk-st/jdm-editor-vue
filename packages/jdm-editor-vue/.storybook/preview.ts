import type { Preview } from '@storybook/vue3';
// PORTING: upstream's @monaco-editor/react provisioned monaco's web workers.
// This port imports `monaco-editor` directly, so the consumer owns them (the
// README documents the requirement) — storybook is such a consumer.
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { h } from 'vue';

import { ensureWasmLoaded } from '../src/helpers/wasm';
import '../src/styles.scss';
import JdmConfigProvider from '../src/theme/JdmConfigProvider.vue';

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    return label === 'typescript' ? new tsWorker() : new editorWorker();
  },
};

// PORTING: upstream's preview awaits the zen engine at module scope, so
// every story renders with the wasm ready (the expression builders call into
// the wasm on their first render).
await ensureWasmLoaded();

const preview: Preview = {
  parameters: {
    // PORTING: upstream's preview is `fullscreen` with the height chain in
    // preview-head.html — a component with `height: 100%` (the decision-graph
    // canvas among them) fills the viewport.
    layout: 'fullscreen',
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      expanded: true,
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  // PORTING: the design tokens are scoped to `.grl-root`, which
  // JdmConfigProvider renders — every story must be wrapped in it or the
  // components render unthemed.
  // The story function returns a component definition; it has to be turned
  // into a vnode (`h(story())`) — returning it raw from the slot
  // stringifies it.
  //
  // The provider is rendered WITHOUT props on purpose: @storybook/vue3 reads
  // a story's live control updates off the ROOT vnode's props, so a root with
  // props (the provider's `theme`) swallows them and every control in the
  // panel stops working. With no props the root falls back to the story
  // context's args. The provider's default mode is `light`, which is what
  // this harness wants.
  decorators: [(story) => h(JdmConfigProvider, null, { default: () => h(story()) })],
};

export default preview;
