export type Monaco = typeof import('monaco-editor');

declare global {
  interface Window {
    monaco?: Monaco;
  }
}

type LoaderConfig = {
  monaco?: Monaco;
};

let monacoInstance: Monaco | null = null;
let initPromise: Promise<Monaco> | null = null;

/**
 * PORTING: upstream re-uses `@monaco-editor/react`'s `loader`; this package does
 * not depend on @monaco-editor/react, so the same singleton surface is
 * re-implemented on top of `monaco-editor` directly:
 *  - `config({ monaco })` registers a self-hosted instance (the README
 *    "Self-hosting Monaco Editor" story: assign `self.monaco` /
 *    `self.MonacoEnvironment` and call `loader.config({ monaco })`).
 *  - `init()` resolves the instance exactly once, preferring a configured
 *    instance, then `window.monaco`, then lazily importing `monaco-editor`.
 *  - `window.MonacoEnvironment` overrides are honoured because monaco-editor
 *    itself consumes them (worker provisioning); nothing is overridden here.
 *
 * WORKER SETUP (consumer's job): upstream gets monaco's web workers for free
 * because @monaco-editor/react provisions them. This port imports the
 * `monaco-editor` package directly, so the CONSUMER's bundler must provide
 * them — a self-hosted monaco without a worker configuration logs
 * "Cannot read properties of undefined (reading 'toUrl')" and the
 * TypeScript language service (the function editor's lint/diagnostics) never
 * starts. With Vite:
 *
 *   import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
 *   import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
 *   self.MonacoEnvironment = {
 *     getWorker(_, label) {
 *       return label === 'typescript' ? new tsWorker() : new editorWorker();
 *     },
 *   };
 */
export const loader = {
  config: (config: LoaderConfig): void => {
    if (config?.monaco) {
      monacoInstance = config.monaco;
      initPromise = Promise.resolve(config.monaco);
    }
  },

  init: (): Promise<Monaco> => {
    if (initPromise) {
      return initPromise;
    }

    if (window.monaco) {
      monacoInstance = window.monaco;
      initPromise = Promise.resolve(monacoInstance);
      return initPromise;
    }

    initPromise = import('monaco-editor').then((monaco) => {
      monacoInstance = monaco;
      return monaco;
    });
    return initPromise;
  },

  __getMonacoInstance: (): Monaco | null => monacoInstance,
};

// PORTING(SSR): `self` doesn't exist under Node SSR — guard the module-level
// pre-config (client-only, SSR-import-safe — see docs/PORTING.md "Stance").
if (typeof self !== 'undefined' && self.monaco) {
  loader.config({ monaco: self.monaco });
}
