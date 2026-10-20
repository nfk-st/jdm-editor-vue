// @vitest-environment jsdom
// Logic-core coverage for the node specification registry (PORTING.md
// testing rule): kind lookup, icon/color/displayName binding, generateNode
// defaults, pure getDiffContent helpers, and createJdmNode's default vs
// user-provided surface (custom-node precedence) — plus mount smokes for the
// node chrome (GraphNode → DecisionNode → GraphCard) and one renderNode.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Component } from 'vue';

import { defaultFunctionValue } from '../../../function/helpers/libs';
import TabDecisionTable from '../../graph/tab-decision-table.vue';
import TabExpression from '../../graph/tab-expression.vue';
import TabFunction from '../../graph/tab-function.vue';
import TabJsonSchema from '../../graph/tab-json-schema.vue';
import { createJdmNode } from '../custom-node';
import GraphNode from '../graph-node.vue';
import { NodeColor } from './colors';
import { decisionTableSpecification } from './decision-table.specification';
import { expressionSpecification } from './expression.specification';
import { functionSpecification } from './function.specification';
import { inputSpecification } from './input.specification';
import { outputSpecification } from './output.specification';
import { NodeKind } from './specification-types';
import { nodeSpecification } from './specifications';
import { switchSpecification } from './switch.specification';

// vitest's jsdom environment ships a non-functional localStorage global
// (dg-store.test.ts precedent) — the detached store bundle reads it for
// compactMode on mount.
const localStorageBacking: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageBacking[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageBacking[key] = String(value);
  },
  removeItem: (key: string) => {
    delete localStorageBacking[key];
  },
});

afterEach(() => {
  for (const key of Object.keys(localStorageBacking)) {
    delete localStorageBacking[key];
  }
});

describe('nodeSpecification registry', () => {
  it('registers exactly the six NodeKind entries', () => {
    expect(Object.keys(nodeSpecification).sort()).toEqual(Object.values(NodeKind).sort());
  });

  it('looks specifications up by kind with matching type fields', () => {
    Object.values(NodeKind).forEach((kind) => {
      expect(nodeSpecification[kind as NodeKind]).toBeDefined();
      expect(nodeSpecification[kind as NodeKind].type).toBe(kind);
    });
  });

  it('binds the upstream colors and display names', () => {
    expect(nodeSpecification[NodeKind.Input].color).toBe(NodeColor.Green);
    expect(nodeSpecification[NodeKind.Output].color).toBe(NodeColor.Green);
    expect(nodeSpecification[NodeKind.Function].color).toBe(NodeColor.Orange);
    expect(nodeSpecification[NodeKind.Switch].color).toBe(NodeColor.Purple);
    expect(nodeSpecification[NodeKind.DecisionTable].color).toBeUndefined();
    expect(nodeSpecification[NodeKind.Expression].color).toBeUndefined();

    expect(nodeSpecification[NodeKind.Input].displayName).toBe('Request');
    expect(nodeSpecification[NodeKind.Output].displayName).toBe('Response');
    expect(nodeSpecification[NodeKind.DecisionTable].displayName).toBe('Decision table');
    expect(nodeSpecification[NodeKind.Expression].displayName).toBe('Expression');
    expect(nodeSpecification[NodeKind.Function].displayName).toBe('Function');
    expect(nodeSpecification[NodeKind.Switch].displayName).toBe('Switch');
  });

  it('stores icons as renderable factories (functional components)', () => {
    Object.values(nodeSpecification).forEach((specification) => {
      // PORTING: upstream stores pre-rendered JSX elements; we store
      // functional components so each node mounts a fresh vnode.
      expect(typeof specification.icon).toBe('function');
    });
  });

  it('exposes renderNode components and optional settings', () => {
    Object.values(nodeSpecification).forEach((specification) => {
      expect(specification.renderNode).toBeDefined();
    });

    expect(expressionSpecification.renderSettings).toBeDefined();
    expect(decisionTableSpecification.renderSettings).toBeDefined();
    expect(inputSpecification.renderSettings).toBeUndefined();
    expect(outputSpecification.renderSettings).toBeUndefined();
    expect(functionSpecification.renderSettings).toBeUndefined();
    expect(switchSpecification.renderSettings).toBeUndefined();
  });

  it('keeps inferTypes where upstream defines it', () => {
    expect(expressionSpecification.inferTypes).toBeDefined();
    expect(decisionTableSpecification.inferTypes).toBeDefined();
    expect(switchSpecification.inferTypes).toBeDefined();
    expect(inputSpecification.inferTypes).toBeUndefined();
    expect(outputSpecification.inferTypes).toBeUndefined();
    expect(functionSpecification.inferTypes).toBeUndefined();

    // switch passes the input straight through and never needs updates
    expect(switchSpecification.inferTypes?.needsUpdate({} as never, {} as never)).toBe(false);
    const passthrough = { clone: () => passthrough } as never;
    expect(switchSpecification.inferTypes?.determineOutputType({ input: passthrough, content: {} })).toBe(passthrough);
  });
});

describe('specification generateNode defaults', () => {
  it('generates the input request node', () => {
    expect(inputSpecification.generateNode({ index: 4 })).toEqual({
      name: 'request',
      content: { schema: '' },
    });
  });

  it('generates the output response node', () => {
    expect(outputSpecification.generateNode({ index: 0 })).toEqual({
      name: 'response',
      content: { schema: '' },
    });
  });

  it('generates a function node seeded with the default source', () => {
    expect(functionSpecification.generateNode({ index: 2 })).toEqual({
      name: 'function2',
      content: { source: defaultFunctionValue },
    });
  });

  it('generates an expression node with the upstream defaults', () => {
    expect(expressionSpecification.generateNode({ index: 1 })).toEqual({
      name: 'expression1',
      content: {
        inputField: null,
        outputPath: null,
        expressions: [],
        passThrough: true,
        executionMode: 'single',
      },
    });
  });

  it('generates a decision table node with one input and one output', () => {
    const node = decisionTableSpecification.generateNode({ index: 3 });
    expect(node.name).toBe('decisionTable3');
    expect(node.content?.inputs).toHaveLength(1);
    expect(node.content?.outputs).toHaveLength(1);
    expect(node.content?.outputs?.[0].field).toBe('output');
    expect(node.content?.rules).toEqual([]);
    expect(node.content?.hitPolicy).toBe('first');
    expect(node.content?.inputs?.[0].id).not.toBe(node.content?.outputs?.[0].id);
  });

  it('generates a switch node with a single non-default statement', () => {
    const node = switchSpecification.generateNode({ index: 0 });
    expect(node.name).toBe('switch0');
    expect(node.content?.hitPolicy).toBe('first');
    expect(node.content?.statements).toHaveLength(1);
    expect(node.content?.statements?.[0]).toMatchObject({ condition: '', isDefault: false });
    expect(node.content?.statements?.[0].id).toBeTruthy();
  });
});

describe('specification getDiffContent', () => {
  it('marks modified input schemas and stays silent when equal', () => {
    const unchanged = inputSpecification.getDiffContent?.({ schema: '{"a": 1}' }, { schema: ' {"a": 1} ' });
    expect(unchanged?._diff).toBeUndefined();

    const modified = inputSpecification.getDiffContent?.({ schema: '{"a": 2}' }, { schema: '{"a": 1}' });
    expect(modified?._diff?.status).toBe('modified');
    expect(modified?._diff?.fields?.schema).toEqual({ previousValue: '{"a": 1}', status: 'modified' });
  });

  it('diffs output schemas identically to input', () => {
    const modified = outputSpecification.getDiffContent?.({ schema: 'b' }, { schema: 'a' });
    expect(modified?._diff?.fields?.schema?.status).toBe('modified');
  });

  it('tracks scalar field changes on expression content', () => {
    const modified = expressionSpecification.getDiffContent?.(
      { executionMode: 'loop', inputField: 'a', outputPath: null, passThrough: false, expressions: [] },
      { executionMode: 'single', inputField: 'a', outputPath: null, passThrough: true, expressions: [] },
    );
    expect(modified?._diff?.status).toBe('modified');
    expect(modified?._diff?.fields?.executionMode?.previousValue).toBe('single');
    expect(modified?._diff?.fields?.passThrough?.previousValue).toBe(true);
    expect(modified?._diff?.fields?.inputField).toBeUndefined();
  });

  it('flags added and removed expression rows through the list unifier', () => {
    const modified = expressionSpecification.getDiffContent?.(
      {
        expressions: [
          { id: '1', key: 'a', value: '1' },
          { id: '2', key: 'b', value: '2' },
        ],
      } as never,
      { expressions: [{ id: '1', key: 'a', value: '1' }] } as never,
    );
    expect(modified?.expressions).toHaveLength(2);
    // the list unifier stamps matched rows 'unchanged' (not undefined)
    expect(modified?.expressions?.[0]._diff).toEqual({ status: 'unchanged' });
    expect(modified?.expressions?.[1]._diff?.status).toBe('added');
    expect(modified?._diff?.fields?.expressions?.status).toBe('modified');
  });

  it('diffs both function content kinds', () => {
    // deprecated (plain string) content
    const deprecated = functionSpecification.getDiffContent?.('a = 1', 'a = 2');
    expect(deprecated).toEqual({
      source: 'a = 1',
      _diff: { status: 'modified', fields: { source: { previousValue: 'a = 2', status: 'modified' } } },
    });

    // stable ({ source }) content
    const stable = functionSpecification.getDiffContent?.({ source: 'a = 1' }, { source: 'a = 1' }) as {
      _diff?: unknown;
    };
    expect(stable?._diff).toBeUndefined();
  });

  it('tracks hit policy and statement condition changes on switch content', () => {
    const modified = switchSpecification.getDiffContent?.(
      { hitPolicy: 'collect', statements: [{ id: '1', condition: 'a > 1' }] },
      { hitPolicy: 'first', statements: [{ id: '1', condition: 'a > 2' }] },
    );
    // upstream records CURRENT.hitPolicy as the previousValue here (kept literal)
    expect(modified?._diff?.fields?.hitPolicy?.previousValue).toBe('collect');
    expect(modified?.statements?.[0]._diff?.fields?.condition?.previousValue).toBe('a > 2');
  });

  it('unifies decision table inputs/outputs/rules lists', () => {
    const current = {
      hitPolicy: 'first',
      inputField: null,
      outputPath: null,
      passThrough: true,
      executionMode: 'single',
      inputs: [{ id: 'i1', name: 'Input' }],
      outputs: [{ id: 'o1', name: 'Output', field: 'output' }],
      rules: [{ _id: 'r1', i1: 'x', o1: 'y' }],
    } as never;
    const previous = {
      hitPolicy: 'first',
      inputField: null,
      outputPath: null,
      passThrough: true,
      executionMode: 'single',
      inputs: [{ id: 'i1', name: 'Renamed' }],
      outputs: [{ id: 'o1', name: 'Output', field: 'output' }],
      rules: [{ _id: 'r1', i1: 'x', o1: 'z' }],
    } as never;

    const modified = decisionTableSpecification.getDiffContent?.(current, previous);
    expect(modified?.inputs?.[0]._diff?.fields?.name?.previousValue).toBe('Renamed');
    expect(modified?._diff?.fields?.inputs?.status).toBe('modified');
    expect(modified?.rules?.[0]._diff?.fields?.o1).toEqual({ previousValue: 'z', status: 'modified' });
    expect(modified?._diff?.fields?.rules?.status).toBe('modified');
  });
});

describe('specification renderTab', () => {
  it('renders the decision table tab', () => {
    const tab = decisionTableSpecification.renderTab?.({ id: 'node-1' });

    expect(tab?.type).toBe(TabDecisionTable);
    expect(tab?.props).toEqual({ id: 'node-1' });
  });

  it('renders the expression tab', () => {
    const tab = expressionSpecification.renderTab?.({ id: 'node-1' });

    expect(tab?.type).toBe(TabExpression);
    expect(tab?.props).toEqual({ id: 'node-1' });
  });

  it('renders the function tab', () => {
    const tab = functionSpecification.renderTab?.({ id: 'node-1' });

    expect(tab?.type).toBe(TabFunction);
    expect(tab?.props).toEqual({ id: 'node-1' });
  });

  it('renders the json-schema tab in its input flavour', () => {
    const tab = inputSpecification.renderTab?.({ id: 'node-1' });

    expect(tab?.type).toBe(TabJsonSchema);
    expect(tab?.props).toEqual({ id: 'node-1', type: 'input' });
  });

  it('renders the json-schema tab in its output flavour', () => {
    const tab = outputSpecification.renderTab?.({ id: 'node-1' });

    expect(tab?.type).toBe(TabJsonSchema);
    expect(tab?.props).toEqual({ id: 'node-1', type: 'output' });
  });

  it('drops the react-dnd manager from every tab', () => {
    // PORTING(DnD): upstream's renderTab received { id, manager } — react-dnd
    // is gone, so no tab receives a manager.
    [
      decisionTableSpecification,
      expressionSpecification,
      functionSpecification,
      inputSpecification,
      outputSpecification,
    ].forEach((specification) => {
      const tab = specification.renderTab?.({ id: 'node-1' });

      expect(tab).toBeTruthy();
      expect(tab?.props).not.toHaveProperty('manager');
    });
  });
});

describe('createJdmNode', () => {
  it('fills the default generateNode from kind and index', () => {
    const specification = createJdmNode({ kind: 'myNode', displayName: 'My Node', inputs: [] });
    expect(specification.kind).toBe('myNode');
    expect(specification.displayName).toBe('My Node');
    expect(specification.generateNode({ index: 3 })).toEqual({ name: 'myNode3' });
  });

  it('falls back to displayName in the generated name when kind is empty', () => {
    const specification = createJdmNode({ kind: '', displayName: 'Fallback', inputs: [] });
    expect(specification.generateNode({ index: 1 }).name).toBe('Fallback1');
  });

  it('keeps user-provided generateNode and renderNode over the defaults', () => {
    const renderNode = (() => null) as unknown as ReturnType<typeof createJdmNode>['renderNode'];
    const specification = createJdmNode({
      kind: 'custom',
      displayName: 'Custom',
      generateNode: () => ({ name: 'fixed' }),
      renderNode,
    });

    expect(specification.generateNode({ index: 9 })).toEqual({ name: 'fixed' });
    expect(specification.renderNode).toBe(renderNode);
  });

  it('provides a default renderNode component when none is given', () => {
    const specification = createJdmNode({ kind: 'custom', displayName: 'Custom' });
    expect(specification.renderNode).toBeTypeOf('object');
  });

  it('passes through the descriptive fields', () => {
    const specification = createJdmNode({
      kind: 'custom',
      displayName: 'Custom',
      group: 'Customs',
      shortDescription: 'A custom node',
      color: 'var(--node-color-blue)',
    });
    expect(specification.group).toBe('Customs');
    expect(specification.shortDescription).toBe('A custom node');
    expect(specification.color).toBe('var(--node-color-blue)');
  });
});

describe('node chrome mount smoke', () => {
  it('mounts GraphNode with the decision-node chrome and settings affordance', () => {
    const wrapper = mount(GraphNode, {
      props: {
        id: 'node-1',
        specification: {
          displayName: 'Expression',
          color: NodeColor.Blue,
          icon: () => null,
          renderSettings: expressionSpecification.renderSettings,
        },
        name: 'my node',
        isSelected: true,
        actions: [],
      },
      slots: { default: '<div class="body-slot" />' },
      // vue-flow's Handle requires a VueFlow node context — stubbed here
      // (graph.vue wires the real one in phase C).
      global: { stubs: { Handle: true, teleport: true } },
    });

    expect(wrapper.find('.grl-dn').exists()).toBe(true);
    expect(wrapper.find('.grl-dn--selected').exists()).toBe(true);
    expect(wrapper.find('.grl-dn__graphCard').exists()).toBe(true);
    expect(wrapper.find('.body-slot').exists()).toBe(true);
    expect(wrapper.text()).toContain('my node');
    // renderSettings present → graph-node appends its Settings action
    expect(wrapper.text()).toContain('Settings');
  });

  it('mounts a specification renderNode (input) through the detached store bundle', () => {
    const wrapper = mount(nodeSpecification[NodeKind.Input].renderNode as unknown as Component, {
      props: {
        id: 'node-2',
        data: { name: 'request' },
        selected: false,
        specification: nodeSpecification[NodeKind.Input],
      },
      global: { stubs: { Handle: true, teleport: true } },
    });

    expect(wrapper.find('.grl-graph-node').exists()).toBe(true);
    expect(wrapper.text()).toContain('Configure');
  });
});
