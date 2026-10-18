// PORTING(SSR): upstream evaluates `navigator.platform` at module level.
// We defer to call time so importing the library under SSR doesn't throw
// (client-only, SSR-import-safe — see docs/PORTING.md "Stance").
const isMac = (): boolean => typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

const keyMaps: Record<string, string> = {
  Ctrl: '⌘',
  Backspace: '⌫',
  Alt: '⌥',
};

export const platform = {
  shortcut: (s: string): string => {
    if (!isMac()) return s;

    return Object.keys(keyMaps).reduce((acc, key) => acc.replaceAll(key, keyMaps[key]), s);
  },
};
