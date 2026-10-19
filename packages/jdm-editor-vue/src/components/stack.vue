<script lang="ts">
// Ported from components/stack.tsx — flex layout utility.
// Render function (not template) so attrs spread + style-override-last keep
// upstream's {...rest} semantics exactly.
import { type PropType, computed, defineComponent, h } from 'vue';

export type StackAlignment =
  'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly' | 'baseline' | 'stretch';

export default defineComponent({
  name: 'Stack',
  inheritAttrs: false,
  props: {
    horizontal: { type: Boolean, default: undefined },
    reversed: { type: Boolean, default: undefined },
    grow: { type: Boolean, default: undefined },
    verticalAlign: { type: String as PropType<StackAlignment>, default: 'start' },
    horizontalAlign: { type: String as PropType<StackAlignment>, default: 'start' },
    gap: { type: [String, Number] as PropType<string | number>, default: 8 },
    height: { type: [String, Number] as PropType<string | number>, default: 'auto' },
    width: { type: [String, Number] as PropType<string | number>, default: '100%' },
  },
  setup(props, { slots, attrs }) {
    const flexDirection = computed(() => {
      if (props.horizontal) {
        return !props.reversed ? 'row' : 'row-reverse';
      }
      return !props.reversed ? 'column' : 'column-reverse';
    });

    // React appends px to numeric style values; Vue assigns them raw
    // (invalid → ignored), so numeric gap/height/width are px-ified here.
    const px = (v: string | number) => (typeof v === 'number' ? `${v}px` : v);

    const computedStyle = computed(() => ({
      display: 'flex',
      flexDirection: flexDirection.value,
      justifyContent: !props.horizontal ? props.verticalAlign : props.horizontalAlign,
      alignItems: !props.horizontal ? props.horizontalAlign : props.verticalAlign,
      height: px(props.height),
      width: px(props.width),
      gap: px(props.gap),
      flexGrow: props.grow ? 1 : undefined,
    }));

    // attr style merges last (upstream {...style} spread-last override)
    const mergedStyle = computed(() => ({ ...computedStyle.value, ...(attrs.style as object) }));

    return () => h('div', { ...attrs, style: mergedStyle.value }, slots.default?.());
  },
});
</script>
