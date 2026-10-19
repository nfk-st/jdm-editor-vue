<script lang="ts">
// Ported from components/decision-table/table/table-head-row.tsx.
import type { HeaderGroup } from '@tanstack/vue-table';
import { match } from 'ts-pattern';

// PORTING(test): upstream derives these inline per header; extracted as pure
// helpers so they are unit-testable and reusable in the template.
export const getParentKind = (parent?: string): 'input' | 'output' | undefined =>
  match(parent)
    .with('inputs', () => 'input' as const)
    .with('outputs', () => 'output' as const)
    .otherwise(() => undefined);

export const getSelfKind = (id: string): 'input' | 'output' | 'description' | undefined =>
  match(id)
    .with('inputs', () => 'input' as const)
    .with('outputs', () => 'output' as const)
    .with('_description', () => 'description' as const)
    .otherwise(() => undefined);
</script>

<script setup lang="ts">
import { FlexRender } from '@tanstack/vue-table';

defineProps<{ headerGroup: HeaderGroup<any> }>();
</script>

<template>
  <!-- PORTING: numeric style values (width/header.getSize()) are px-ified —
       React did that automatically for known properties, Vue does not. -->
  <tr :key="headerGroup.id">
    <th colspan="1" :style="{ width: '72px' }" />
    <th
      v-for="header in headerGroup.headers"
      :key="header.id"
      :colspan="header.colSpan"
      :data-self="getSelfKind(header.column.id)"
      :data-parent="getParentKind(header.column.parent?.id)"
      :style="
        getSelfKind(header.column.id) !== 'description'
          ? { width: `${header.getSize()}px` }
          : { minWidth: `${header.getSize()}px`, width: '100%' }
      "
    >
      <FlexRender v-if="!header.isPlaceholder" :render="header.column.columnDef.header" :props="header.getContext()" />
      <!-- PORTING: React wires onMouseDown={header.getResizeHandler()}
           (pre-invoked); Vue must call the returned handler with the event. -->
      <div
        v-if="header.column.getCanResize()"
        class="resizer"
        :class="[
          getSelfKind(header.column.id) === 'description' && 'resizer--last',
          header.column.getIsResizing() && 'isResizing',
        ]"
        @mousedown="header.getResizeHandler()($event)"
        @touchstart="header.getResizeHandler()($event)"
      />
    </th>
  </tr>
</template>
