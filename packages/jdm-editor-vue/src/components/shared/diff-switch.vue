<script lang="ts">
export type DiffSwitchProps = {
  modelValue?: boolean;
  previousChecked?: boolean;
  displayDiff?: boolean;
  disabled?: boolean;
};
</script>

<script setup lang="ts">
import ArrowDiffIcon from '../arrow-diff-icon.vue';
import Switch from '../ui/Switch.vue';

// Ported from components/shared/diff-switch.tsx (antd Space → inline flex).
// PORTING(P7): unknown attrs pass through to the live switch.
defineOptions({ inheritAttrs: false });

defineProps<DiffSwitchProps>();

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'change', value: boolean): void }>();
</script>

<template>
  <div class="grl-space" style="gap: 4px">
    <template v-if="displayDiff">
      <Switch :model-value="previousChecked" size="small" :disabled="disabled" />
      <ArrowDiffIcon />
    </template>
    <Switch
      v-bind="$attrs"
      :model-value="modelValue"
      size="small"
      :disabled="disabled"
      @update:model-value="(v) => emit('update:modelValue', v)"
      @change="(v) => emit('change', v)"
    />
  </div>
</template>

<style lang="scss">
.grl-space {
  display: inline-flex;
  align-items: center;
}
</style>
