<script lang="ts">
// Ported from components/code-editor/ce-highlight.tsx — the read-only
// highlighted preview used by CodeEditor's lazy mode.
import { syntaxTree } from '@codemirror/language';
import type { Diagnostic } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { highlightCode as lzHighlightCode } from '@lezer/highlight';

import type { CodeEditorBaseProps } from './ce-base.vue';
import { escapeHtml } from './extensions/diagnostic';
import { zenExtensions, zenStyleDark, zenStyleLight } from './extensions/zen';

const STYLE_ID = 'zen-highlight-styles';
const injectStyles = (theme: 'light' | 'dark') => {
  const style = theme === 'dark' ? zenStyleDark : zenStyleLight;
  const id = `${STYLE_ID}-${theme}`;
  if (typeof document === 'undefined' || document.getElementById(id)) {
    return;
  }

  if (style.module) {
    const styleEl = document.createElement('style');
    styleEl.id = id;
    styleEl.textContent = style.module.getRules();

    document.head.appendChild(styleEl);
  }
};

type HighlightCodeParams = {
  code: string;
  type?: 'standard' | 'unary' | 'template';
  theme?: 'light' | 'dark';
  placeholder?: string;
};

export const highlightCode = ({
  code,
  theme = 'light',
  type = 'standard',
  placeholder,
}: HighlightCodeParams): string => {
  if (!code.trim()) {
    return `<span class="cm-line">${placeholder ? `<span class="cm-placeholder">${placeholder}</span>` : '<br />'}</span>`;
  }

  try {
    const highlightStyle = theme === 'dark' ? zenStyleDark : zenStyleLight;
    const state = EditorState.create({
      doc: code,
      extensions: [zenExtensions({ type, lazy: true })],
    });

    const tree = syntaxTree(state);
    if (!tree || tree.length === 0) {
      return escapeHtml(code);
    }

    let html = '<span class="cm-line"><span class="cm-lintRange">';

    lzHighlightCode(
      code,
      tree,
      highlightStyle,
      (text, classes) => {
        if (classes) {
          html += `<span class="${classes}">${escapeHtml(text)}</span>`;
        } else {
          html += escapeHtml(text);
        }
      },
      () => {
        html += '\n</span></span><span class="cm-line"><span class="cm-lintRange">';
      },
    );

    html += '</span></span>';

    return html;
  } catch (error) {
    console.warn('Syntax highlighting failed:', error);
    return escapeHtml(code);
  }
};

export type CodeHighlighterProps = CodeEditorBaseProps;
</script>

<script setup lang="ts">
import { createVariableType } from '@gorules/zen-engine-wasm';
import clsx from 'clsx';
import { P, match } from 'ts-pattern';
import { computed, ref, watch } from 'vue';

import { isWasmAvailable } from '../../helpers/wasm';
import { useThemeMode } from '../../theme';
import { renderDiagnosticMessage } from './extensions/diagnostic';
import { validateZenExpression } from './extensions/linter';

defineOptions({ inheritAttrs: false });

// Declared props double as the "stripped" set upstream destructures away
// (extension, initialSelection, disabled, livePreview, … never reach the DOM).
const props = withDefaults(defineProps<CodeHighlighterProps>(), {
  noStyle: false,
  fullHeight: false,
  strict: false,
  type: 'standard',
  lint: true,
});

// antd theme.useToken() → useThemeMode() (docs/PORTING.md antd → tokens).
const mode = useThemeMode();
const tooltip = ref<{ x: number; y: number; diagnostics: Diagnostic[] } | null>(null);
const diagnostics = ref<Diagnostic[] | null>(null);
// PORTING: upstream's ref forwards to the root div — exposed as `el`.
const rootRef = ref<HTMLDivElement | null>(null);

watch(
  mode,
  (m) => {
    injectStyles(m);
  },
  { immediate: true },
);

watch(diagnostics, (value) => {
  if (!value?.length) {
    tooltip.value = null;
  }
});

const highlighted = computed(() =>
  highlightCode({ code: props.value ?? '', type: props.type, theme: mode.value, placeholder: props.placeholder }),
);

watch(
  [
    () => props.value,
    () => props.lint,
    () => props.variableType,
    () => props.expectedVariableType,
    () => props.type,
    () => props.strict,
  ],
  ([value, lint, variableType, expectedVariableType, type, strict]) => {
    if (!value || !value.trim() || !lint || !isWasmAvailable()) {
      diagnostics.value = null;
      return;
    }

    // PORTING: upstream wraps this computation in startTransition — Vue has no
    // equivalent, so it runs synchronously.
    const types = match([type, variableType])
      .with(['unary', P.nonNullable], () => createVariableType(variableType).typeCheckUnary(value))
      .with(['standard', P.nonNullable], () => createVariableType(variableType).typeCheck(value))
      .otherwise(() => []);

    diagnostics.value = validateZenExpression({
      source: value,
      expectedVariableType,
      expressionType: type as 'standard',
      strict,
      types,
    });
  },
  { immediate: true },
);

const diagnosticSeverity = computed(() => {
  if (!diagnostics.value) {
    return undefined;
  }

  if (diagnostics.value.some((d) => d.severity === 'error')) {
    return 'error';
  } else if (diagnostics.value.some((d) => d.severity === 'warning')) {
    return 'warning';
  } else if (diagnostics.value.some((d) => d.severity === 'info')) {
    return 'info';
  } else if (diagnostics.value.some((d) => d.severity === 'hint')) {
    return 'hint';
  }

  return undefined;
});

const handleMouseEnter = (e: MouseEvent) => {
  if (!diagnostics.value?.length) return;

  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();

  tooltip.value = {
    x: rect.left,
    y: rect.bottom,
    diagnostics: diagnostics.value,
  };
};

const handleMouseLeave = () => {
  tooltip.value = null;
};

defineExpose({ el: rootRef });
</script>

<template>
  <div
    ref="rootRef"
    v-bind="$attrs"
    tabindex="0"
    :class="
      clsx(
        'grl-ce',
        'grl-ce-highlighter',
        noStyle && 'no-style',
        maxRows && !fullHeight && 'max-rows',
        fullHeight && 'full-height',
      )
    "
    :style="{ '--editorMaxRows': maxRows }"
  >
    <div class="cm-editor" :data-severity="diagnosticSeverity">
      <div class="cm-scroller">
        <div
          class="cm-content cm-lineWrapping"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
          v-html="highlighted"
        />
      </div>
      <!-- PORTING: React dangerouslySetInnerHTML → v-html (same HTML strings). -->
      <div
        v-if="tooltip"
        class="cm-tooltip-hover cm-tooltip cm-tooltip-below"
        :style="{ position: 'fixed', top: `${tooltip.y}px`, left: `${tooltip.x}px` }"
      >
        <ul class="cm-tooltip-lint cm-tooltip-section">
          <li
            v-for="(diagnostic, idx) in tooltip.diagnostics"
            :key="idx"
            :class="`cm-diagnostic cm-diagnostic-${diagnostic.severity}`"
          >
            <span class="cm-diagnosticText">
              <div
                v-html="renderDiagnosticMessage({ text: diagnostic.message, className: 'cm-diagnosticMessageToken' })"
              />
            </span>
            <div v-if="diagnostic.source" class="cm-diagnosticSource">{{ diagnostic.source }}</div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
