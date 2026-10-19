<script setup lang="ts">
// Private recursive node renderer for ui/JsonTree.vue — the local counterpart
// of react-json-tree@0.20.0's JSONNestedNode/JSONValueNode pair. The li shape
// (arrow div > label + span, children ul) is kept identical so ported module
// SCSS overrides (function.scss `__debugger__log__values`) keep working.
// PORTING: render props (labelRenderer/valueRenderer) stay FUNCTION props
// instead of slots — they must recurse through every node (ce-base's
// `extension` function-prop precedent); shouldExpandNodeInitially defaults to
// react-json-tree's expandRootNode (root expanded) like upstream.
import { type CSSProperties, type FunctionalComponent, type VNodeChild, computed, ref } from 'vue';

export type JsonTreeKeyPath = (string | number)[];
export type JsonTreeTheme = { base00?: string; base03?: string; base0B?: string; base0D?: string };

const props = withDefaults(
  defineProps<{
    value: unknown;
    keyPath: JsonTreeKeyPath;
    level?: number;
    theme?: JsonTreeTheme;
    shouldExpandNodeInitially?: (keyPath: JsonTreeKeyPath, data: unknown, level: number) => boolean;
    labelRenderer?: (keyPath: JsonTreeKeyPath, nodeType: string, expanded: boolean, expandable: boolean) => VNodeChild;
    valueRenderer?: (valueAsString: string, value: unknown, keyPath: JsonTreeKeyPath) => VNodeChild;
  }>(),
  { level: 0 },
);

// react-json-tree objType, reduced to the JSON-only surface this port needs.
const objType = (value: unknown): string => {
  if (Array.isArray(value)) return 'Array';
  if (value === null) return 'Null';
  switch (typeof value) {
    case 'object':
      return 'Object';
    case 'string':
      return 'String';
    case 'number':
      return 'Number';
    case 'boolean':
      return 'Boolean';
    case 'undefined':
      return 'Undefined';
    default:
      return typeof value;
  }
};

const nodeType = computed(() => objType(props.value));
const isNested = computed(() => nodeType.value === 'Object' || nodeType.value === 'Array');

const entries = computed<{ key: string | number; value: unknown }[]>(() => {
  if (nodeType.value === 'Array') {
    return (props.value as unknown[]).map((value, index) => ({ key: index, value }));
  }
  if (nodeType.value === 'Object') {
    return Object.getOwnPropertyNames(props.value).map((key) => ({
      key,
      value: (props.value as Record<string, unknown>)[key],
    }));
  }
  return [];
});

const expandable = computed(() => entries.value.length > 0);
const expanded = ref(
  props.shouldExpandNodeInitially
    ? props.shouldExpandNodeInitially(props.keyPath, props.value, props.level)
    : props.level === 0,
);

const toggle = () => {
  if (expandable.value) {
    expanded.value = !expanded.value;
  }
};

// react-json-tree's valueGetter mapping (JSONNode.js).
const valueAsString = computed<string>(() => {
  switch (nodeType.value) {
    case 'String':
      return `"${props.value as string}"`;
    case 'Number':
      return String(props.value);
    case 'Boolean':
      return props.value ? 'true' : 'false';
    case 'Null':
      return 'null';
    case 'Undefined':
      return 'undefined';
    default:
      return String(props.value);
  }
});

const nodeTypeIndicator = computed(() => (nodeType.value === 'Array' ? '[]' : '{}'));
const itemString = computed(() =>
  nodeType.value === 'Array'
    ? `${entries.value.length} ${entries.value.length !== 1 ? 'items' : 'item'}`
    : `${entries.value.length} ${entries.value.length !== 1 ? 'keys' : 'key'}`,
);

// defaultLabelRenderer/defaultItemString of react-json-tree's JSONTree.
const defaultLabel = `${String(props.keyPath[0])}:`;

// base16 default styling (createStylingFromTheme.js), the dynamic bits inline.
const nestedStyle = computed(() => ({
  paddingTop: '0.25em',
  marginLeft: props.keyPath.length > 1 ? '0.875em' : 0,
  paddingLeft: !expandable.value ? '1.125em' : 0,
}));
const valueStyle = computed<CSSProperties>(() => ({
  paddingTop: '0.25em',
  paddingRight: 0,
  marginLeft: '0.875em',
  paddingLeft: props.keyPath.length > 1 ? '2.125em' : '1.25em',
  textIndent: '-0.5em',
  wordBreak: 'break-all',
  wordWrap: 'break-word',
}));

// Tiny functional shim so renderer-function props can return VNodeChild.
const VNodeRender: FunctionalComponent<{ render: () => VNodeChild }> = (renderProps) => renderProps.render();
</script>

<template>
  <!-- nested node: arrow (when expandable) + label + item string + children -->
  <li v-if="isNested" class="grl-json-node grl-json-node--nested" :style="nestedStyle">
    <div v-if="expandable" class="grl-json-tree__arrow-container" @click="toggle">
      <div
        class="grl-json-tree__arrow"
        :style="{ color: theme?.base0D, transform: expanded ? 'rotateZ(90deg)' : 'rotateZ(0deg)' }"
      >
        ▶
      </div>
    </div>
    <label
      class="grl-json-tree__label"
      :class="{ 'grl-json-tree__label--expandable': expandable }"
      :style="{ color: theme?.base0D }"
      @click="toggle"
    >
      <VNodeRender v-if="labelRenderer" :render="() => labelRenderer?.(keyPath, nodeType, expanded, expandable)" />
      <template v-else>{{ defaultLabel }}</template>
    </label>
    <span
      class="grl-json-tree__item-string"
      :style="{ color: expanded ? theme?.base03 : theme?.base0B }"
      @click="toggle"
    >
      {{ nodeTypeIndicator }} {{ itemString }}
    </span>
    <ul v-if="expanded" class="grl-json-tree__children">
      <JsonNode
        v-for="entry in entries"
        :key="entry.key"
        :value="entry.value"
        :key-path="[entry.key, ...keyPath]"
        :level="level + 1"
        :theme="theme"
        :should-expand-node-initially="shouldExpandNodeInitially"
        :label-renderer="labelRenderer"
        :value-renderer="valueRenderer"
      />
    </ul>
  </li>

  <!-- value node: label + value (no arrow — same li shape as react-json-tree) -->
  <li v-else class="grl-json-node grl-json-node--value" :style="valueStyle">
    <label class="grl-json-tree__label grl-json-tree__value-label" :style="{ color: theme?.base0D }">
      <VNodeRender v-if="labelRenderer" :render="() => labelRenderer?.(keyPath, nodeType, false, false)" />
      <template v-else>{{ defaultLabel }}</template>
    </label>
    <span class="grl-json-tree__value-text">
      <VNodeRender v-if="valueRenderer" :render="() => valueRenderer?.(valueAsString, value, keyPath)" />
      <template v-else>{{ valueAsString }}</template>
    </span>
  </li>
</template>

<style lang="scss">
.grl-json-tree__arrow-container {
  display: inline-block;
  padding-right: 0.5em;
  cursor: pointer;
}

.grl-json-tree__arrow {
  position: relative;
  font-size: 0.75em;
  line-height: 1.1em;
  transform-origin: 45% 50%;
  transition: transform 150ms;
}

.grl-json-tree__label {
  display: inline-block;
  margin: 0;
  padding: 0;
  cursor: default;

  &--expandable {
    cursor: pointer;
  }
}

.grl-json-tree__value-label {
  margin: 0 0.5em 0 0;
  cursor: default;
}

.grl-json-tree__item-string {
  padding-left: 0.5em;
  cursor: default;
}

.grl-json-tree__value-text {
  user-select: text;
}

.grl-json-tree__children {
  padding: 0;
  margin: 0;
  list-style: none;
}
</style>
