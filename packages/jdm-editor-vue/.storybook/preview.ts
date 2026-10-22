// The dark-mode toggle's channel. The addon's own entry point cannot be
// imported here: it pulls React in (its toolbar is React), and the preview
// has no React. The event name is its exported constant.
import { addons } from '@storybook/preview-api';
import type { Preview } from '@storybook/vue3';
// PORTING: upstream's @monaco-editor/react provisioned monaco's web workers.
// This port imports `monaco-editor` directly, so the consumer owns them (the
// README documents the requirement) — storybook is such a consumer.
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { defineComponent, h, ref, watchEffect } from 'vue';

import { ensureWasmLoaded } from '../src/helpers/wasm';
import '../src/styles.scss';
import JdmConfigProvider from '../src/theme/JdmConfigProvider.vue';

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    // PORTING: monaco labels the TypeScript language service 'typescript' AND
    // 'javascript' (the Function editor's default language is javascript) —
    // upstream's README routes both to the ts worker.
    return label === 'typescript' || label === 'javascript' ? new tsWorker() : new editorWorker();
  },
};

// PORTING: upstream awaits the zen engine at module scope, so every story
// renders with the wasm ready (the expression builders call into the wasm on
// their first render).
await ensureWasmLoaded();

const DARK_MODE_EVENT_NAME = 'DARK_MODE';

// The dark-mode state, shared by the decorator below. The `storybook-dark-mode`
// addon's toolbar emits the event on the channel; upstream's preview reads it
// with the addon's React hook, which the Vue preview cannot use.
const mode = ref<'light' | 'dark'>('light');
addons.getChannel().on(DARK_MODE_EVENT_NAME, (isDark: boolean) => {
  mode.value = isDark ? 'dark' : 'light';
});

// The dark background, as upstream's preview sets it.
watchEffect(() => {
  document.documentElement.style.backgroundColor = mode.value === 'dark' ? '#1f1f1f' : '#ffffff';
});

// PORTING: the provider is rendered WITHOUT props on purpose:
// @storybook/vue3 reads a story's live control updates off the ROOT vnode's
// props, so a root with props (the provider's `theme`) swallows them and
// every control in the panel stops working. With no props the root falls
// back to the story context's args.
//
// The dark-mode toggle needs the provider's `theme` prop — and that prop on
// the ROOT is exactly what breaks the controls. So the root is a wrapper with
// NO props (the controls keep working) and the provider — one level down —
// carries the theme.
const ThemeHost = defineComponent({
  name: 'ThemeHost',
  setup(_props, { slots }) {
    return () => h(JdmConfigProvider, { theme: { mode: mode.value } }, { default: () => slots.default?.() });
  },
});

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
        date: /Date$/,
      },
    },
  },
  // PORTING: the design tokens are scoped to `.grl-root`, which
  // JdmConfigProvider renders — every story must be wrapped in it or the
  // components render unthemed.
  // The story function returns a component definition; it has to be turned
  // into a vnode (`h(story())`) — returning it raw from the slot
  // stringifies it.
  decorators: [(story) => h(ThemeHost, null, { default: () => h(story()) })],
};

export default preview;
