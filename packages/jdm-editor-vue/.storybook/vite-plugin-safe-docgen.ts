import type { Plugin } from 'vite';

/**
 * The docgen plugin appends `;<exportName>.__docgenInfo = {…}` for every
 * export of a module it processes. On a **barrel** file the export is a
 * re-export, not a local binding — so the assignment throws a
 * `ReferenceError` at module evaluation, and the module graph the story
 * loads dies with it (the story never renders).
 *
 * This rewrite keeps the per-component assignment for `.vue` modules (the
 * docs page reads `__docgenInfo` off the component) and routes the
 * assignments in plain modules to a global map, where a missing binding
 * cannot throw. Barrels are not components, so nothing reads that data.
 */
export const safeDocgenInfo = (): Plugin => ({
  name: 'jdm:storybook-safe-docgen',
  enforce: 'post',
  transform(code, id) {
    if (!/\.(ts|tsx|js|jsx)$/.test(id.split('?')[0])) {
      return null;
    }

    if (!code.includes('.__docgenInfo')) {
      return null;
    }

    return {
      code: code.replace(
        /;(\w+)\.__docgenInfo = /g,
        ';globalThis.__docgenInfo ??= {}; globalThis.__docgenInfo["$1"] = ',
      ),
      map: null,
    };
  },
});
