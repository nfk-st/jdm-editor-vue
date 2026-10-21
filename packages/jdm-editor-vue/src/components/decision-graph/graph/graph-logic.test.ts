// @vitest-environment jsdom
// Logic-core coverage for the decision-graph canvas chrome (PORTING.md's
// testing rule): the Decision-View node derivations, the excel→node
// mapping and the excel-dialog's header/selection derivations.
import { describe, expect, it } from 'vitest';

import type { ParsedExcelData } from '../../../helpers/excel';
import { NodeKind } from '../../../helpers/schema';
import type { DecisionGraphType } from '../dg-types';
import type { MergedDataItem } from './graph-excel-dialog.vue';
import {
  buildMergedData,
  buildSelectedItemsMap,
  buildStepItems,
  isHeaderMatch,
  mergeHeaders,
} from './graph-excel-dialog.vue';
import { buildDecisionViewNodes, groupDecisionViewNodes } from './graph-nodes.vue';
import { mapExcelDataToNodes, mergeExcelNodes } from './graph-side-toolbar.vue';

const decisionGraph: DecisionGraphType = {
  nodes: [
    { id: 'n1', name: 'First', type: NodeKind.Expression, position: { x: 0, y: 0 } },
    { id: 'n2', name: 'Second', type: NodeKind.Function, position: { x: 0, y: 0 } },
    { id: 'n3', name: 'Table', type: NodeKind.DecisionTable, position: { x: 0, y: 0 } },
  ],
  edges: [],
};

describe('buildDecisionViewNodes', () => {
  it('maps the graph nodes into view items', () => {
    const items = buildDecisionViewNodes(decisionGraph, [], undefined);

    expect(items.map((item) => [item.id, item.name, item.type])).toEqual([
      ['n1', 'First', NodeKind.Expression],
      ['n2', 'Second', NodeKind.Function],
      ['n3', 'Table', NodeKind.DecisionTable],
    ]);
  });

  it('marks the editable kinds as enabled and the rest as disabled', () => {
    const items = buildDecisionViewNodes(decisionGraph, [], undefined);

    expect(items.find((item) => item.id === 'n1')?.disabled).toBe(false);
    expect(items.find((item) => item.id === 'n3')?.disabled).toBe(false);
  });

  it('filters to the nodes the view config permits', () => {
    const items = buildDecisionViewNodes(decisionGraph, [], {
      enabled: true,
      permissions: { n1: 'edit:full' },
    });

    expect(items.map((item) => item.id)).toEqual(['n1']);
  });

  it('keeps every node when the view config is off', () => {
    const items = buildDecisionViewNodes(decisionGraph, [], { enabled: false });
    expect(items).toHaveLength(3);
  });

  it('tolerates a missing graph', () => {
    expect(buildDecisionViewNodes(undefined, [], undefined)).toEqual([]);
  });
});

describe('groupDecisionViewNodes', () => {
  it('groups the nodes by kind', () => {
    const items = buildDecisionViewNodes(decisionGraph, [], undefined);
    const groups = groupDecisionViewNodes(items, '');

    expect(groups.map((group) => [group.title, group.nodes.length])).toEqual([
      ['Decision Tables', 1],
      ['Expressions', 1],
      ['Functions', 1],
    ]);
  });

  it('filters by a case-insensitive search', () => {
    const items = buildDecisionViewNodes(decisionGraph, [], undefined);
    const groups = groupDecisionViewNodes(items, 'sec');

    expect(groups.find((group) => group.title === 'Functions')?.nodes.map((n) => n.name)).toEqual(['Second']);
    expect(groups.find((group) => group.title === 'Expressions')?.nodes).toEqual([]);
  });

  it('ignores a whitespace-only search', () => {
    const items = buildDecisionViewNodes(decisionGraph, [], undefined);
    const groups = groupDecisionViewNodes(items, '   ');

    expect(groups.reduce((total, group) => total + group.nodes.length, 0)).toBe(3);
  });
});

describe('mapExcelDataToNodes', () => {
  const merged: MergedDataItem = {
    id: 'sheet-1',
    name: 'Risk',
    type: NodeKind.DecisionTable,
    position: { x: 10, y: 20 },
    hitPolicy: 'first',
    items: [
      { id: 'in-1', label: 'Age', value: 'customer age', type: 'input' },
      { id: 'out-1', label: 'Risk Level', value: 'risk level', type: 'output' },
    ],
    rules: [
      [
        { headerId: 'in-1', value: '18' },
        { headerId: 'out-1', value: 'low' },
      ],
    ],
  };

  it('builds a decision-table node from the merged sheet', () => {
    const [node] = mapExcelDataToNodes([merged]);

    expect(node.id).toBe('sheet-1');
    expect(node.name).toBe('Risk');
    expect(node.type).toBe(NodeKind.DecisionTable);
    expect(node.position).toEqual({ x: 10, y: 20 });
  });

  it('normalises an input field into a dotted lower-case path', () => {
    const [node] = mapExcelDataToNodes([merged]);
    const inputs = (node.content as { inputs: { field: string }[] }).inputs;

    expect(inputs[0].field).toBe('customer.age');
  });

  it('camel-cases an output field', () => {
    const [node] = mapExcelDataToNodes([merged]);
    const outputs = (node.content as { outputs: { field: string }[] }).outputs;

    expect(outputs[0].field).toBe('riskLevel');
  });

  it('flattens the rules onto the header ids', () => {
    const [node] = mapExcelDataToNodes([merged]);
    const rules = (node.content as { rules: Record<string, unknown>[] }).rules;

    expect(rules[0]['in-1']).toBe('18');
    expect(rules[0]['out-1']).toBe('low');
    expect(rules[0]._id).toEqual(expect.any(String));
  });
});

describe('mergeExcelNodes', () => {
  const existing = [
    { id: 'a', name: 'A', type: NodeKind.DecisionTable, content: { old: true }, position: { x: 0, y: 0 } },
    { id: 'b', name: 'B', type: NodeKind.DecisionTable, content: { old: true }, position: { x: 250, y: 0 } },
  ] as never[];

  const fromExcel = [
    { id: 'a', name: 'A', type: NodeKind.DecisionTable, content: { new: true }, position: { x: 0, y: 0 } },
    { id: 'c', name: 'C', type: NodeKind.DecisionTable, content: { new: true }, position: { x: 0, y: 0 } },
  ] as never[];

  it('updates the existing nodes in place and returns the new ones separately', () => {
    const { updatedNodes, newNodes } = mergeExcelNodes(existing, fromExcel);

    expect(updatedNodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect((updatedNodes[0].content as { new?: boolean }).new).toBe(true);
    expect((updatedNodes[1].content as { new?: boolean }).new).toBeUndefined();
    expect(newNodes.map((n) => n.id)).toEqual(['c']);
  });

  it('places the new nodes on the first free row, cascading right', () => {
    const { newNodes } = mergeExcelNodes(existing, fromExcel);

    // (0,0) and (250,0) are taken, so the new node lands at (500,0)
    expect(newNodes[0].position).toEqual({ x: 500, y: 0 });
  });
});

describe('isHeaderMatch', () => {
  it('matches on id, value or label (case-insensitive)', () => {
    expect(isHeaderMatch({ id: 'a', label: 'A' }, { id: 'a', label: 'B' })).toBe(true);
    expect(isHeaderMatch({ id: 'a', label: 'A', value: 'x' }, { id: 'b', label: 'B', value: 'X' })).toBe(true);
    expect(isHeaderMatch({ id: 'a', label: 'Age' }, { id: 'b', label: 'age' })).toBe(true);
  });

  it('does not match two headers with different ids, values and labels', () => {
    expect(isHeaderMatch({ id: 'a', label: 'Age', value: 'age' }, { id: 'b', label: 'Other', value: 'other' })).toBe(
      false,
    );
  });

  it('matches two headers that both lack a value (upstream: undefined === undefined)', () => {
    // upstream's isHeaderMatch is byte-identical to the port's: two headers
    // with no value compare undefined === undefined and therefore match.
    expect(isHeaderMatch({ id: 'a', label: 'Age' }, { id: 'b', label: 'Other' })).toBe(true);
  });
});

describe('mergeHeaders', () => {
  it('keeps the new header but falls back to the existing one', () => {
    expect(
      mergeHeaders(
        { id: 'a', label: '', value: '', type: 'input' },
        { id: 'b', label: 'Old', value: 'old', type: 'output' },
      ),
    ).toEqual({
      id: 'a',
      label: 'Old',
      value: 'old',
      // the new header's own type wins when it has one
      type: 'input',
    });
  });

  it('falls back to the existing type when the new header has none', () => {
    expect(
      mergeHeaders({ id: 'a', label: '', value: '' }, { id: 'b', label: 'Old', value: 'old', type: 'output' }),
    ).toEqual({
      id: 'a',
      label: 'Old',
      value: 'old',
      type: 'output',
    });
  });

  it('falls back to the label when there is no value', () => {
    expect(mergeHeaders({ id: 'a', label: 'Age' })).toEqual({ id: 'a', label: 'Age', value: 'Age' });
  });
});

describe('buildStepItems', () => {
  const excelData = [
    {
      id: 'sheet-1',
      name: 'Risk',
      type: NodeKind.DecisionTable,
      position: { x: 0, y: 0 },
      headers: [
        { id: 'h1', name: 'Age', value: 'age', _type: 'input' },
        { id: 'h2', name: 'Risk', value: 'risk', _type: 'output' },
      ],
      rules: [],
      existingTableData: {
        headers: [{ id: 'existing', name: 'Region', field: 'region', type: 'input' }],
        hitPolicy: 'first',
        passThrough: false,
        executionMode: 'single',
      },
    },
  ] as unknown as ParsedExcelData[];

  it('merges the excel headers with the existing table headers', () => {
    const items = buildStepItems(excelData, 0);

    expect(items.map((item) => item.id)).toContain('h1');
    expect(items.map((item) => item.id)).toContain('existing');
  });

  it('appends the trailing description column', () => {
    const items = buildStepItems(excelData, 0);
    const description = items.find((item) => item.id === '_description');

    expect(description).toMatchObject({ label: 'DESCRIPTION', value: 'description' });
  });
});

describe('buildSelectedItemsMap', () => {
  it('makes the last column the output when there is no description', () => {
    const map = buildSelectedItemsMap([
      { id: 'a', label: 'Age', value: 'age', type: 'input' },
      { id: 'b', label: 'Risk', value: 'risk', type: 'input' },
    ]);

    expect(map.a.type).toBe('input');
    expect(map.b.type).toBe('output');
  });

  it('makes the second-to-last column the output when there is a description', () => {
    const map = buildSelectedItemsMap([
      { id: 'a', label: 'Age', value: 'age', type: 'input' },
      { id: 'b', label: 'Risk', value: 'risk', type: 'input' },
      { id: '_description', label: 'DESCRIPTION', value: 'description' },
    ]);

    expect(map.b.type).toBe('output');
    expect(map._description.type).toBeUndefined();
  });

  it('does not create a second output', () => {
    const map = buildSelectedItemsMap([
      { id: 'a', label: 'Age', value: 'age', type: 'output' },
      { id: 'b', label: 'Risk', value: 'risk', type: 'input' },
    ]);

    expect(map.b.type).toBe('input');
  });
});

describe('buildMergedData', () => {
  const excelData = [
    {
      id: 'sheet-1',
      name: 'Risk',
      type: NodeKind.DecisionTable,
      position: { x: 5, y: 6 },
      headers: [],
      rules: [
        [
          { headerId: 'h1', value: '18' },
          { headerId: 'h2', value: 'low' },
        ],
      ],
      existingTableData: {
        headers: [],
        hitPolicy: 'first',
        passThrough: false,
        executionMode: 'single',
      },
    },
  ] as unknown as ParsedExcelData[];

  const selectedItems = {
    step0: {
      h1: { id: 'h1', label: 'Age', value: 'age', type: 'input' },
      h2: { id: 'h2', label: 'Risk', value: 'risk', type: 'output' },
    },
  } as never;

  it('maps the selected headers and rules', () => {
    const [merged] = buildMergedData({ excelData, selectedItems, headerWrapStates: {} });

    expect(merged.id).toBe('sheet-1');
    expect(merged.items.map((item) => item.id)).toEqual(['h1', 'h2']);
    expect(merged.rules[0]).toEqual([
      { headerId: 'h1', value: '18' },
      { headerId: 'h2', value: 'low' },
    ]);
  });

  it('quotes the rule values of the wrapped headers', () => {
    const [merged] = buildMergedData({
      excelData,
      selectedItems,
      headerWrapStates: { step0: { h2: true } },
    });

    expect(merged.rules[0][1].value).toBe('"low"');
  });
});
