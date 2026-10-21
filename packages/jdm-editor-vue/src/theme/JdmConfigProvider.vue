<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { ensureWasmLoaded } from '../helpers/wasm';
import { type DictionaryMap, type ThemeConfig, provideDictionaries, useProvideThemeMode } from './index';

const props = defineProps<{
  theme?: ThemeConfig;
  dictionaries?: DictionaryMap;
}>();

const mode = computed(() => props.theme?.mode ?? 'light');
const modeRef = ref(mode.value);
watch(mode, (val) => (modeRef.value = val)); // keep the provided ref live if the prop toggles

useProvideThemeMode(modeRef);
provideDictionaries(props.dictionaries ?? {});

// Kick off WASM (Zen engine) init as soon as the editor mounts — mirrors upstream useWasmReady().
void ensureWasmLoaded();

const tokenStyle = computed(() => props.theme?.tokens ?? {});
</script>

<template>
  <div class="grl-root" :data-mode="mode" :style="tokenStyle">
    <slot />
  </div>
</template>
