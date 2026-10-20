<script lang="ts">
// Ported from components/decision-graph/graph/tab-function.tsx.
// PORTING(DnD): upstream's `manager`/dnd plumbing dropped with react-dnd.
export type TabFunctionProps = {
  id: string;
};

// PORTING: upstream reads `content.source` when the function is Stable
// (content is `{ source } | string`). The shape is named here instead of
// written inline in the template: an inline object type literal in a
// template expression breaks vue-tsc's codegen (the generated TSX closes
// the JSX expression container at the `{`).
export type FunctionNodeContent = {
  source: string;
};
</script>

<script setup lang="ts">
// PORTING: React.lazy(Function) + Suspense/Spin → defineAsyncComponent with a
// Spinner loading state; @monaco-editor/react's Monaco type → helpers/monaco.
import type { editor } from 'monaco-editor';
import { P, match } from 'ts-pattern';
import { computed, defineAsyncComponent, shallowRef, watch } from 'vue';

import type { Monaco } from '../../../helpers/monaco';
import { useNodeType } from '../../../helpers/node-type';
import type { FunctionPermission, FunctionProps } from '../../function';
import Spinner from '../../ui/Spinner.vue';
import {
  useDecisionGraphActions,
  useDecisionGraphListeners,
  useDecisionGraphState,
  useNodeDiff,
} from '../context/dg-store.context';
import { useTabSerializer } from '../context/serializer.context';
import { FunctionKind, useFunctionKind } from '../nodes/specifications/function.specification';
import type { SimulationTrace, SimulationTraceDataFunction } from '../simulator/simulation.types';

// upstream: React.lazy(async () => ({ default: (await import('../../function')).Function }))
const Function = defineAsyncComponent({
  loader: async () => (await import('../../function')).Function,
  loadingComponent: Spinner,
});

const props = defineProps<TabFunctionProps>();

const kind = useFunctionKind(props.id);
const graphActions = useDecisionGraphActions();
const onFunctionReady = useDecisionGraphListeners((s) => s.onFunctionReady);
const monaco = shallowRef<Monaco | undefined>(undefined);
const editorRef = shallowRef<editor.IStandaloneCodeEditor | null>(null);
const pendingViewStateRef = shallowRef<editor.ICodeEditorViewState | null>(null);

useTabSerializer<editor.ICodeEditorViewState | null>(props.id, 'monaco', {
  serialize: () => editorRef.value?.saveViewState() ?? pendingViewStateRef.value ?? null,
  restore: (state) => {
    if (!state) return;
    if (editorRef.value) {
      editorRef.value.restoreViewState(state);
    } else {
      pendingViewStateRef.value = state;
    }
  },
});

const nodeType = useNodeType(props.id);
const state = useDecisionGraphState(({ simulate, disabled, decisionGraph, viewConfig }) => ({
  nodeTrace: match(simulate)
    .with({ result: P._ }, ({ result }) => result?.trace?.[props.id])
    .otherwise(() => null),
  nodeError: match(simulate)
    .with({ error: { data: { nodeId: props.id } } }, ({ error }) => error)
    .otherwise(() => null),
  disabled,
  content: (decisionGraph?.nodes ?? []).find((node) => node.id === props.id)?.content,
  viewConfig,
}));

const { diff, contentDiff } = useNodeDiff(props.id);

// upstream: useMemo over [diff, contentDiff] — a computed over the ComputedRef
// slices (reactivity supersedes the dependency list).
const previousValue = computed(() => {
  return kind.value === FunctionKind.Stable
    ? contentDiff.value?.fields?.source?.previousValue
    : diff.value?.fields?.content?.previousValue;
});

// upstream: useEffect([monaco, onFunctionReady])
watch(
  () => [monaco.value, onFunctionReady.value] as const,
  ([instance, onReady]) => {
    if (!instance) {
      return;
    }

    const extraLibs = instance.languages.typescript.javascriptDefaults.getExtraLibs();
    const newExtraLibs = Object.entries(extraLibs).map(([key, value]) => ({
      filePath: key,
      content: value.content,
    }));

    instance.languages.typescript.javascriptDefaults.setExtraLibs(newExtraLibs);
    onReady?.(instance);
  },
);

const permission = computed<FunctionPermission>(
  () =>
    (state.value.viewConfig?.enabled
      ? state.value.viewConfig?.permissions?.[props.id]
      : 'edit:full') as FunctionPermission,
);
</script>

<template>
  <Function
    :model-value="kind === FunctionKind.Stable ? (state.content as FunctionNodeContent)?.source : state.content"
    :previous-value="typeof previousValue === 'string' ? previousValue : undefined"
    :error="(state.nodeError as FunctionProps['error']) ?? undefined"
    :input-data="nodeType"
    :permission="permission"
    :disabled="state.disabled"
    :trace="state.nodeTrace as SimulationTrace<SimulationTraceDataFunction>"
    @monaco-ready="(instance: Monaco) => (monaco = instance)"
    @editor-mount="
      (mounted: editor.IStandaloneCodeEditor) => {
        editorRef = mounted;
        if (pendingViewStateRef) {
          mounted.restoreViewState(pendingViewStateRef);
          pendingViewStateRef = null;
        }
      }
    "
    @update:model-value="
      (val: string) => {
        graphActions.updateNode(id, (draft) => {
          if (kind === FunctionKind.Stable) {
            draft.content = { source: val };
          } else {
            draft.content = val;
          }

          return draft;
        });
      }
    "
  />
</template>
