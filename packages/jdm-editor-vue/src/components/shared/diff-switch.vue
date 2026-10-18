<script setup lang="ts">
// Ported from components/shared/diff-switch.tsx (antd Space → inline flex).
import Switch from '../ui/Switch.vue';
import ArrowDiffIcon from '../arrow-diff-icon.vue';

defineProps<{
  modelValue?: boolean;
  previousChecked?: boolean;
  displayDiff?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'change', value: boolean): void }>();
</script>

<template>
  <div class="grl-space" style="gap: 4px">
    <template v-if="displayDiff">
      <Switch :model-value="previousChecked" size="small" :disabled="disabled" />
      <ArrowDiffIcon />
    </template>
    <Switch
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
