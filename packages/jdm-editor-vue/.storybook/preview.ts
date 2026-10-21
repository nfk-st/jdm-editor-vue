import type { Preview } from '@storybook/vue3';
// PORTING: upstream's @monaco-editor/react provisioned monaco's web workers.
// This port imports `monaco-editor` directly, so the consumer owns them (the
// README documents the requirement) — storybook is such a consumer.
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { h } from 'vue';

import '../src/styles.scss';
import JdmConfigProvider from '../src/theme/JdmConfigProvider.vue';

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    return label === 'typescript' ? new tsWorker() : new editorWorker();
  },
};

const preview: Preview = {
  // PORTING: the design tokens are scoped to `.grl-root`, which
  // JdmConfigProvider renders — every story must be wrapped in it or the
  // components render unthemed.
  // The story function returns a component definition; it has to be turned
  // into a vnode (`h(story())`) — returning it raw from the slot
  // stringifies it.
  decorators: [(story) => h(JdmConfigProvider, { theme: { mode: 'light' } }, { default: () => h(story()) })],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
