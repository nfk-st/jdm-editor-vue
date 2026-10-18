export { default as JdmConfigProvider } from './JdmConfigProvider.vue';

import { computed, provide, inject, ref, type InjectionKey, type Ref } from 'vue';

export type JdmThemeMode = 'light' | 'dark';

/** Token overrides applied as inline CSS custom properties on the root element. */
export type ThemeConfig = {
  mode?: JdmThemeMode;
  tokens?: Record<string, string>;
};

/** Named option sets for expression building — domain data, not i18n (see CONTEXT.md). */
export type DictionaryMap = Record<string, { label: string; value: string }[]>;

const DictionaryKey: InjectionKey<DictionaryMap> = Symbol('jdm-dictionaries');
const ThemeModeKey: InjectionKey<Readonly<Ref<JdmThemeMode>>> = Symbol('jdm-theme-mode');

export const provideDictionaries = (dictionaries: DictionaryMap): void => {
  provide(DictionaryKey, dictionaries);
};

export const useDictionaries = (): DictionaryMap => inject(DictionaryKey, {});

export const useThemeMode = (): Readonly<Ref<JdmThemeMode>> => inject(ThemeModeKey, ref('light'));

export const useProvideThemeMode = (mode: Ref<JdmThemeMode>): void => {
  provide(ThemeModeKey, readonly(mode));
};
