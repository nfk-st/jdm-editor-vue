<script lang="ts">
// react-json-tree replacement (docs/PORTING.md dependency map: "react-json-tree
// → local JsonTree component in components/ui/") — renders the same ul/li DOM
// shape and base16 layout metrics as react-json-tree@0.20.0 so ported module
// SCSS overrides (function.scss `__debugger__log__values`) keep working.
// Not ported (no consumer in this port — debugger logs are plain JSON):
// collectionLimit/ItemRange chunking, Map/Set/Iterable/Date/Error nodes,
// circular-reference detection, sortObjectKeys, hideRoot, invertTheme.
import JsonNode, { type JsonTreeKeyPath, type JsonTreeTheme } from './JsonNode.vue';

export type { JsonTreeKeyPath, JsonTreeTheme };
</script>

<script setup lang="ts">
import type { VNodeChild } from 'vue';

withDefaults(
  defineProps<{
    data: unknown;
    theme?: JsonTreeTheme;
    keyPath?: JsonTreeKeyPath;
    shouldExpandNodeInitially?: (keyPath: JsonTreeKeyPath, data: unknown, level: number) => boolean;
    labelRenderer?: (keyPath: JsonTreeKeyPath, nodeType: string, expanded: boolean, expandable: boolean) => VNodeChild;
    valueRenderer?: (valueAsString: string, value: unknown, keyPath: JsonTreeKeyPath) => VNodeChild;
  }>(),
  { keyPath: () => ['root'] },
);
</script>

<template>
  <ul class="grl-json-tree" :style="{ backgroundColor: theme?.base00 }">
    <JsonNode
      :value="data"
      :key-path="keyPath"
      :level="0"
      :theme="theme"
      :should-expand-node-initially="shouldExpandNodeInitially"
      :label-renderer="labelRenderer"
      :value-renderer="valueRenderer"
    />
  </ul>
</template>

<style lang="scss">
.grl-json-tree {
  margin: 0.5em 0 0.5em 0.125em;
  padding: 0;
  list-style: none;
  user-select: none;
}
</style>
