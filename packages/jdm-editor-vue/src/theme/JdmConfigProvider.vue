<script setup lang="ts">
import { ConfigProvider, ToastProvider } from 'reka-ui';
import { computed, reactive, ref, watch } from 'vue';

import Toast from '../components/ui/Toast.vue';
import { ensureWasmLoaded } from '../helpers/wasm';
import { type DictionaryMap, type JdmConfigProviderProps, provideDictionaries, useProvideThemeMode } from './index';

const props = defineProps<JdmConfigProviderProps>();

const mode = computed(() => props.theme?.mode ?? 'light');
const modeRef = ref(mode.value);
watch(mode, (val) => (modeRef.value = val)); // keep the provided ref live if the prop toggles

useProvideThemeMode(modeRef);

// PORTING: upstream re-provides the dictionaries on every render (React
// context value); provide() runs once per setup here, so a reactive holder
// is provided and kept in sync with the prop (dt.vue's DictionaryBridge
// precedent). A dictionary loaded after mount now reaches the expression
// builders.
// PORTING: upstream's `useDictionaries` returns the context value, which
// React re-reads on every render. Vue's provide() runs once per setup, so a
// provider that handed over a plain object would freeze the dictionaries at
// mount — a dictionary loaded later never reached the expression builders.
// The holder is reactive: provide() it once, and mutate it in place.
const createDictionaryHolder = (): DictionaryMap => reactive<DictionaryMap>({});

const syncDictionaryHolder = (holder: DictionaryMap, next: DictionaryMap | undefined): void => {
  for (const key of Object.keys(holder)) {
    delete holder[key];
  }

  Object.assign(holder, next ?? {});
};

const dictionaries = createDictionaryHolder();
watch(
  () => props.dictionaries,
  (next) => syncDictionaryHolder(dictionaries, next),
  { immediate: true, deep: true },
);
provideDictionaries(dictionaries);

// Kick off WASM (Zen engine) init as soon as the editor mounts — mirrors upstream useWasmReady().
void ensureWasmLoaded();

const tokenStyle = computed(() => props.theme?.tokens ?? {});

// PORTING: reka's overlays (tooltip, modal, select, popover, dropdown menu,
// context menu) teleport to `body` by default. The design tokens live on
// .grl-root, so a portalled overlay resolved no var(--grl-*) at all — no
// background, no border, no shadow, and no dark mode (the
// .grl-root[data-mode='dark'] rules could not match). Portalling INTO
// .grl-root keeps the tokens — and the per-instance theme overrides — in
// scope. reka's ConfigProvider renders no element of its own, so the DOM
// shape is unchanged.
const rootEl = ref<HTMLElement | null>(null);
</script>

<template>
  <div ref="rootEl" class="grl-root" :data-mode="mode" :style="tokenStyle">
    <ConfigProvider :teleport-to="rootEl ?? undefined">
      <ToastProvider :duration="3000" :limit="5">
        <Toast />
        <slot />
      </ToastProvider>
    </ConfigProvider>
  </div>
</template>
