import { type InjectionKey, type Ref, computed, inject, provide, readonly, ref } from 'vue';

export { default as JdmConfigProvider } from './JdmConfigProvider.vue';

export type JdmThemeMode = 'light' | 'dark';

/** Token overrides applied as inline CSS custom properties on the root element. */
export type ThemeConfig = {
  mode?: JdmThemeMode;
  tokens?: Record<string, string>;
};

/** Named option sets for expression building — domain data, not i18n (see CONTEXT.md). */
export type DictionaryMap = Record<string, { label: string; value: string }[]>;

/**
 * Upstream's `JdmConfigProviderProps` (theme.tsx). `prefixCls` is dropped —
 * it is an antd-only concept (ADR-0001) — and upstream's `children` is the
 * Vue slot.
 */
export type JdmConfigProviderProps = {
  theme?: ThemeConfig;
  dictionaries?: DictionaryMap;
};

const DictionaryKey: InjectionKey<DictionaryMap> = Symbol('jdm-dictionaries');
const ThemeModeKey: InjectionKey<Readonly<Ref<JdmThemeMode>>> = Symbol('jdm-theme-mode');

export const provideDictionaries = (dictionaries: DictionaryMap): void => {
  provide(DictionaryKey, dictionaries);
};

export const useDictionaries = (): DictionaryMap => inject(DictionaryKey, {});

// PORTING(additive): upstream has no theme-mode API — antd's algorithm
// owns the mode. The port's dark mode is its own, so a host needs to read
// it (and provide it, for a nested editor).
export const useThemeMode = (): Readonly<Ref<JdmThemeMode>> => inject(ThemeModeKey, ref('light'));

export const useProvideThemeMode = (mode: Ref<JdmThemeMode>): void => {
  provide(ThemeModeKey, readonly(mode));
};
