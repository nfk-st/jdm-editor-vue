// Ported from components/code-editor/ce.stories.tsx — upstream's CSF2 + React
// story becomes CSF3 with a Vue render function.
// PORTING: upstream's `fn()` from @storybook/test → `action()` from
// @storybook/addon-actions (@storybook/test is not a dependency of this port).
// PORTING: upstream's `value`/`onChange` → `modelValue`/`update:modelValue`
// (docs/PORTING.md's React → Vue table); upstream's `onStateChange` → the
// port's `stateChange` emit.
// PORTING: upstream's antd `Typography` / `theme.useToken()` → plain elements
// styled with the port's `--grl-*` design tokens (see the Debug story).
// PORTING: upstream's storybook preview awaits the zen-engine wasm at module
// scope; the port's preview boots it asynchronously (JdmConfigProvider), so
// the wasm-dependent parts of the Debug / LivePreview stories wait for
// `useWasmReady()` instead of throwing.
import { syntaxTree } from '@codemirror/language';
import type { EditorState as CmEditorState } from '@codemirror/state';
import { Variable, createVariableType, generateAst, generateAstUnary } from '@gorules/zen-engine-wasm';
import type { SyntaxNodeRef } from '@lezer/common';
import { action } from '@storybook/addon-actions';
import type { ComponentPropsAndSlots, Meta, StoryObj } from '@storybook/vue3';
import { match } from 'ts-pattern';
import { type PropType, computed, defineComponent, h, ref } from 'vue';

import { useWasmReady } from '../../helpers/wasm';
import CodeEditorPreview from './ce-preview.vue';
import CodeEditor from './ce.vue';

// PORTING: upstream's `onFocus` is a React `HTMLAttributes` passthrough (the
// port's CodeEditor emits `blur` only), so it is typed as a plain
// fall-through DOM listener on the editor's root element.
type CodeEditorArgs = ComponentPropsAndSlots<typeof CodeEditor> & {
  onFocus?: (event: FocusEvent) => void;
};

type DebugArgs = CodeEditorArgs & {
  showTypeInfo: boolean;
  showParserState: boolean;
  showEditorState: boolean;
};

type LivePreviewArgs = CodeEditorArgs & {
  noPreviewText: string;
  initialExpression: string;
  initialResult: unknown;
};

const meta = {
  title: 'CodeEditor',
  component: CodeEditor,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    'modelValue': { control: 'text' },
    'maxRows': { control: 'number' },
    'disabled': { control: 'boolean' },
    'placeholder': { control: 'text' },
    'type': { control: 'radio', options: ['standard', 'unary', 'template'] },
    'strict': { control: 'boolean' },
    'variableType': { control: 'object' },
    'expectedVariableType': { control: 'object' },
    'noStyle': { control: 'boolean' },
    'onUpdate:modelValue': { table: { disable: true } },
    'onBlur': { table: { disable: true } },
    'onFocus': { table: { disable: true } },
    'lazy': { control: 'boolean' },
  },
  args: {
    'maxRows': 3,
    'placeholder': 'Type expression...',
    'type': 'standard',
    'disabled': false,
    'strict': false,
    'onUpdate:modelValue': action('onChange'),
    'onBlur': action('onBlur'),
    'onFocus': action('onFocus'),
    'variableType': {
      customer: {
        firstName: 'John',
        lastName: 'Doe',
        groups: ['admin'],
      },
      cart: {
        totals: 100,
        items: [
          { id: 1, qty: 2, price: 20 },
          { id: 2, qty: 1, price: 50 },
        ],
      },
    },
  },
} satisfies Meta<CodeEditorArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

// upstream: the Controlled story keeps the value in React state.
const ControlledHost = defineComponent({
  name: 'ControlledHost',
  props: {
    args: { type: Object as PropType<CodeEditorArgs>, required: true },
  },
  setup(props) {
    const value = ref<string>('');

    return () =>
      h(CodeEditor, {
        ...props.args,
        'modelValue': value.value,
        'onUpdate:modelValue': (next: string) => {
          value.value = next;
        },
      });
  },
});

// upstream: antd `Typography.Text` + `theme.useToken()` → plain elements
// styled with the port's design tokens.
const DebugPanel = defineComponent({
  name: 'DebugPanel',
  props: {
    title: { type: String, required: true },
    content: { type: String, required: true },
  },
  setup(props) {
    return () =>
      h('div', { style: { marginTop: '16px' } }, [
        h('span', { class: 'grl-typography' }, props.title),
        h(
          'div',
          {
            style: {
              background: 'var(--grl-color-bg-layout)',
              border: '1px solid var(--grl-color-border)',
              borderRadius: 'var(--grl-border-radius)',
              padding: '12px',
            },
          },
          [
            h(
              'span',
              { class: 'grl-typography', style: { whiteSpace: 'pre', fontFamily: 'monospace' } },
              props.content,
            ),
          ],
        ),
      ]);
  },
});

// upstream: the Debug story computes the ZEN parser state, the ZEN type info
// and the CodeMirror syntax tree on every change / state change.
const DebugHost = defineComponent({
  name: 'DebugHost',
  props: {
    args: { type: Object as PropType<CodeEditorArgs>, required: true },
    showTypeInfo: { type: Boolean, default: false },
    showParserState: { type: Boolean, default: false },
    showEditorState: { type: Boolean, default: false },
  },
  setup(props) {
    const wasmReady = useWasmReady();
    const editorState = ref('');
    const parserState = ref('');
    const typeInfo = ref('');

    // upstream: useMemo(() => createVariableType(args.variableType), [args.variableType])
    const variableType = computed(() => {
      if (!wasmReady.value) {
        return undefined;
      }

      try {
        return createVariableType(props.args.variableType);
      } catch {
        return undefined;
      }
    });

    const handleChange = (expression: string) => {
      if (!wasmReady.value) {
        return;
      }

      const type = props.args.type ?? 'standard';

      const ast = match(type)
        .with('standard', () => generateAst(expression))
        .with('unary', () => generateAstUnary(expression))
        .otherwise(() => null);

      parserState.value = ast ?? '';

      const vt = variableType.value;
      if (!vt) {
        typeInfo.value = '';
        return;
      }

      const info = match(type)
        .with('unary', () => vt.typeCheckUnary(expression))
        .otherwise(() => vt.typeCheck(expression));

      typeInfo.value = JSON.stringify(info, undefined, 2);
    };

    const handleStateChange = (state: CmEditorState) => {
      const nodes: string[] = [];

      syntaxTree(state).iterate({
        enter(node: SyntaxNodeRef): boolean | void {
          nodes.push(
            `${node.name}[${node.from}:${node.to}] = ${node.type.isError}, ${node.node.tree?.children.length}`,
          );
        },
      });

      editorState.value = JSON.stringify(nodes, undefined, 2);
    };

    return () =>
      h('div', [
        h(CodeEditor, {
          ...props.args,
          'onUpdate:modelValue': handleChange,
          'onStateChange': handleStateChange,
        }),
        props.showTypeInfo ? h(DebugPanel, { title: 'Type Info (ZEN)', content: typeInfo.value }) : null,
        props.showParserState ? h(DebugPanel, { title: 'Parser state (ZEN)', content: parserState.value }) : null,
        props.showEditorState
          ? h(DebugPanel, { title: 'Editor state (CodeMirror)', content: editorState.value })
          : null,
      ]);
  },
});

// upstream: the LivePreview story evaluates the expression against a zen
// `Variable` built from the story's `variableType`.
const LivePreviewHost = defineComponent({
  name: 'LivePreviewHost',
  props: {
    args: { type: Object as PropType<CodeEditorArgs>, required: true },
    noPreviewText: { type: String, required: true },
    initialExpression: { type: String, required: true },
    initialResult: { type: null, default: undefined },
  },
  setup(props) {
    const wasmReady = useWasmReady();
    const expression = ref<string>(props.initialExpression);

    // upstream: useMemo(() => new Variable(variableType), [variableType])
    const inputData = computed(() => {
      if (!wasmReady.value) {
        return undefined;
      }

      try {
        return new Variable(props.args.variableType);
      } catch {
        return undefined;
      }
    });

    return () =>
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, [
        h(CodeEditor, {
          ...props.args,
          'modelValue': expression.value,
          'onUpdate:modelValue': (next: string) => {
            expression.value = next;
          },
        }),
        h(CodeEditorPreview, {
          expression: expression.value,
          noPreviewText: props.noPreviewText,
          inputData: inputData.value,
          initial: { expression: props.initialExpression, result: props.initialResult },
        }),
      ]);
  },
});

export const Uncontrolled: Story = {
  render: (args) => h(CodeEditor, args),
};

export const Controlled: Story = {
  render: (args) => h(ControlledHost, { args }),
};

export const FullHeight: Story = {
  args: {
    fullHeight: true,
  },
  render: (args) => h('div', { style: { height: '200px' } }, [h(CodeEditor, args)]),
};

export const NoStyle: Story = {
  args: {
    noStyle: true,
  },
  render: (args) =>
    h('div', {}, [
      h('p', {}, 'Parent border'),
      h('div', { style: { border: '1px solid blue' } }, [h(CodeEditor, args)]),
    ]),
};

export const Debug: StoryObj<DebugArgs> = {
  args: {
    showTypeInfo: false,
    showParserState: false,
    showEditorState: false,
  },
  argTypes: {
    showTypeInfo: {
      control: 'boolean',
      description: 'Toggle type info visibility',
    },
    showParserState: {
      control: 'boolean',
      description: 'Toggle parser state visibility',
    },
    showEditorState: {
      control: 'boolean',
      description: 'Toggle editor state visibility',
    },
  },
  render: (args) => {
    const { showTypeInfo, showParserState, showEditorState, ...editorArgs } = args;

    return h(DebugHost, {
      args: editorArgs,
      showTypeInfo,
      showParserState,
      showEditorState,
    });
  },
};

export const LivePreview: StoryObj<LivePreviewArgs> = {
  args: {
    noPreviewText: 'Run simulation to see the results',
    initialExpression: 'customer.firstName + " " + customer.lastName',
    initialResult: 'John Doe',
  },
  argTypes: {
    noPreviewText: { control: 'text' },
    initialExpression: { control: 'text' },
    initialResult: { control: 'object' },
  },
  render: (args) => {
    const { noPreviewText, initialExpression, initialResult, ...editorArgs } = args;

    return h(LivePreviewHost, {
      args: editorArgs,
      noPreviewText,
      initialExpression,
      initialResult,
    });
  },
};
