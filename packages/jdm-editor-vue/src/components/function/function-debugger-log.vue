<script lang="ts">
// Ported from components/function/function-debugger-log.tsx.
export type FunctionDebuggerLogProps = {
  lines: string[];
  msSinceRun: number | null;
};

export type JsonTheme = {
  string: string;
  constants: string;
  number: string;
  type: string;
  error: string;
  info: string;
};
</script>

<script setup lang="ts">
// PORTING: antd Dropdown (trigger=['contextMenu']) + menu → reka-ui
// ContextMenu with .grl-context-menu classes (expression/dt recipe);
// antd message.success → console stand-in (dt-command-bar precedent, swap when
// ui/Toast lands); antd Tooltip → ui/Tooltip; react-json-tree JSONTree →
// ui/JsonTree — its labelRenderer/valueRenderer render props port as h()-
// returning functions so this file keeps upstream's helper names 1:1;
// antd theme.useToken → useThemeMode().
import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui';
import { type VNodeChild, computed, h } from 'vue';

import { copyToClipboard } from '../../helpers/utility';
import { useThemeMode } from '../../theme';
import JsonTree, { type JsonTreeTheme } from '../ui/JsonTree.vue';
import Tooltip from '../ui/Tooltip.vue';

const props = defineProps<FunctionDebuggerLogProps>();

// PORTING: antd message.success → console (no toast primitive in ui/ yet; swap
// when one lands).
const message = {
  success: (m: string) => console.info(m),
};

// antd theme.useToken() → useThemeMode() (docs/PORTING.md antd → tokens).
const mode = useThemeMode();

const themes: Record<'dark' | 'light', JsonTheme> = {
  dark: {
    string: '#CE9178',
    number: '#B5CEA8',
    constants: '#569CD6',
    type: '#3DC9B0',
    error: '#E51400',
    info: 'rgba(0, 0, 0, 0.65)',
  },
  light: {
    string: '#A31515',
    number: '#098658',
    constants: '#0000FF',
    type: '#008080',
    error: '#E51400',
    info: 'rgba(0, 0, 0, 0.65)',
  },
};

const jsonTheme = computed<JsonTheme>(() => themes[mode.value ?? 'light']);

// upstream passes antd token values; ours are token CSS custom properties
// (inline styles resolve var() at paint).
const treeTheme = computed<JsonTreeTheme>(() => ({
  base00: 'var(--grl-color-bg-elevated)',
  base03: 'var(--grl-color-text-base)',
  base0B: 'var(--grl-color-text-base)',
  base0D: 'var(--grl-color-text-base)',
}));

const objectRenderer =
  (jsonTheme: JsonTheme) =>
  (data: any, nodeType: string): VNodeChild => {
    if (nodeType === 'Object') {
      const objectData = data as Record<string, any>;
      const objectEntries = Object.entries(objectData);
      const renders = objectEntries.reduce(
        (acc: VNodeChild[], [key, value], currentIndex) => [
          ...acc,
          h('span', { key }, [
            `${key}: `,
            valueRenderer(jsonTheme)(stringifyJsonData(value), value),
            currentIndex !== objectEntries.length - 1 && ', ',
          ]),
        ],
        [] satisfies VNodeChild[],
      );

      return [' {', renders, '}'];
    } else if (nodeType === 'Array') {
      const arrayData = data as any[];
      const renders = arrayData.reduce(
        (acc, value, currentIndex) => [
          ...acc,
          h('span', { key: currentIndex }, [
            valueRenderer(jsonTheme)(stringifyJsonData(value), value),
            currentIndex !== arrayData.length - 1 && ', ',
          ]),
        ],
        [] satisfies VNodeChild[],
      );

      return [arrayData.length > 2 ? `(${arrayData.length})` : '', ' [', renders, ']'];
    } else {
      return null;
    }
  };

const stringifyJsonData = (value: unknown): string => {
  switch (true) {
    case Array.isArray(value):
      return `Array(${(value as unknown[]).length})`;
    case typeof value === 'object':
      return '{...}';
    default:
      return JSON.stringify(value);
  }
};

const valueRenderer =
  (jsonTheme: JsonTheme) =>
  (valueAsStr: unknown, value: unknown): VNodeChild => {
    const valueAsString = valueAsStr as string;
    if (typeof value === 'string') {
      if (valueAsString.startsWith('"Error:')) {
        return h('span', { style: { color: jsonTheme.error } }, valueAsString.slice(1, -1));
      }

      if (valueAsString.startsWith('"Info:')) {
        return h('span', { style: { color: jsonTheme.info } }, valueAsString.slice(1, -1));
      }

      return h('span', { style: { color: jsonTheme.string } }, valueAsString);
    } else if (typeof value === 'boolean') {
      return h('span', { style: { color: jsonTheme.constants } }, valueAsString);
    } else if (typeof value === 'number') {
      return h('span', { style: { color: jsonTheme.number } }, valueAsString);
    }

    return valueAsString;
  };

const lens = (obj: any, path: (string | number)[]) => path.reduce((o, key) => (o && o[key] ? o[key] : null), obj);

const safeParseJson = (data: string): unknown => {
  if (typeof data !== 'string') {
    return undefined;
  }

  data = data.trim();
  if (!data) {
    return undefined;
  }

  try {
    return JSON.parse(data);
  } catch {
    return `[UNSERIALIZED]: ${data}`;
  }
};

// upstream's inline JSONTree labelRenderer, lifted into a per-line factory so
// each tree's closure lenses over its own parsed data.
const makeLabelRenderer =
  (data: unknown) =>
  (keyPath: readonly (string | number)[], nodeType: string): VNodeChild => {
    const parts: VNodeChild[] = [];

    const lastPart = keyPath?.[0];
    if (lastPart !== 'root') {
      parts.push([h('span', { style: { color: jsonTheme.value.constants } }, String(lastPart)), ': ']);
    }

    if (keyPath.length >= 1) {
      let paths = [...keyPath];
      paths.pop();
      paths = paths.reverse();

      parts.push(objectRenderer(jsonTheme.value)(lens(data, paths), nodeType));
    }

    return parts;
  };

const expandNothing = () => false;

const lineData = computed(() =>
  props.lines.map((line) => {
    const data = safeParseJson(line);
    return { data, labelRenderer: makeLabelRenderer(data), valueRenderer: valueRenderer(jsonTheme.value) };
  }),
);

const onCopy = async () => {
  await copyToClipboard(props.lines.length === 1 ? props.lines[0] : `[${props.lines.join(', ')}]`);
  message.success('Copied to clipboard');
};
</script>

<template>
  <div class="grl-function__debugger__log">
    <ContextMenuRoot>
      <ContextMenuTrigger as-child>
        <div class="grl-function__debugger__log__values">
          <JsonTree
            v-for="(line, i) in lineData"
            :key="i"
            :data="line.data"
            :theme="treeTheme"
            :should-expand-node-initially="expandNothing"
            :label-renderer="line.labelRenderer"
            :value-renderer="line.valueRenderer"
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuPortal>
        <ContextMenuContent class="grl-context-menu" :style="{ minWidth: '200px' }">
          <ContextMenuItem class="grl-context-menu__item" @select="onCopy"> Copy to clipboard </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenuRoot>
    <div class="grl-function__debugger__log__time">
      <Tooltip v-if="msSinceRun !== null" content="Time since start of execution of script.">
        <span>{{ msSinceRun }}ms</span>
      </Tooltip>
    </div>
  </div>
</template>
