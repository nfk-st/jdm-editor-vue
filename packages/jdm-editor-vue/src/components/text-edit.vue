<script lang="ts">
// Ported from components/text-edit.tsx — click-to-edit in-place text input.
// Internal component (not re-exported from upstream's components/index), so
// props keep upstream names: value / onChange.
export type TextEditProps = {
  value?: string;
  disabled?: boolean;
};
</script>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = defineProps<TextEditProps>();

const emit = defineEmits<{ (e: 'change', text: string): void }>();

const contentEditing = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

// upstream: useEffect([contentEditing]) sets the (uncontrolled) input value,
// then focuses + selects it.
watch(contentEditing, async (editing) => {
  if (!editing) {
    return;
  }

  await nextTick();
  if (inputRef.value) {
    inputRef.value.value = props.value as string;
    inputRef.value.focus();
    inputRef.value.select();
  }
});

const startEditing = () => {
  if (!props.disabled) {
    contentEditing.value = true;
  }
};

const onBlur = (e: FocusEvent) => {
  const target = e.target as HTMLInputElement;
  if (target.value?.trim?.()?.length > 0) {
    emit('change', inputRef.value?.value as string);
  }
  contentEditing.value = false;
};

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    (e.currentTarget as HTMLInputElement).blur();
    e.preventDefault();
  } else if (e.key === 'Escape') {
    if (inputRef.value) {
      inputRef.value.value = props.value as string;
    }
    contentEditing.value = false;
    e.preventDefault();
  }
};
</script>

<template>
  <!-- PORTING(P7): upstream spreads {...rest} (className/style/attrs) onto
       the div — unknown attrs fall through automatically here. -->
  <div class="grl-text-edit">
    <span v-if="!contentEditing" class="grl-typography grl-text-edit__text" @click="startEditing">
      {{ value }}
    </span>
    <input
      v-if="contentEditing"
      ref="inputRef"
      class="grl-text-edit__input nodrag"
      type="text"
      @blur="onBlur"
      @keydown="onKeyDown"
    />
  </div>
</template>

<style lang="scss">
// PORTING: upstream styles this from the global styles.scss; the block moved
// here (unscoped, so the nested `.grl-dt-text-primary .grl-text-edit__*`
// selectors in dt.scss keep working).
.grl-text-edit {
  display: flex;
  flex-direction: column;
  margin-right: 8px;
  max-width: 140px;

  &__text,
  &__input {
    line-height: 1.2em;
    padding: 1px 5px;
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: 14px !important;
  }

  &__text {
    transition: var(--grl-transition);
    overflow: hidden;
    white-space: nowrap;
    width: min-content;
    text-overflow: ellipsis;
    max-width: 100%;

    &:hover:not(:focus-within) {
      background-color: var(--grl-color-bg-text-hover);
    }
  }

  &__input {
    font-family: var(--grl-font-family);
    border-color: var(--grl-color-primary-border);
    outline: none !important;
  }
}
</style>
