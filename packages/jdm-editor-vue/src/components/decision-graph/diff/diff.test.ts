// @vitest-environment jsdom
// Logic-core coverage for the decision-graph diff engine (PORTING.md's
// testing rule): the string comparison helpers, the list unifier, and the
// node/edge diff processors. Upstream ships no tests — this coverage is new.
import { describe, expect, it } from 'vitest';

import type { DecisionEdge, DecisionNode } from '../dg-types';
import { NodeKind } from '../nodes/specifications/specification-types';
import { addStrikethrough, buildDiffString, compareAndUnifyLists, compareStringFields } from './comparison';
import { calculateDiffGraph, processEdges, processNodes } from './utility';

// A node's content is diffed by its specification's getDiffContent, so the
// fixture carries a valid expression content (the expression specification
// reads executionMode / inputField / outputPath off it).
const expressionContent = () => ({
  expressions: [],
  passThrough: false,
  inputField: 'input',
  outputPath: 'output',
  executionMode: 'single' as const,
});

const dnode = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    name: id,
    type: NodeKind.Expression,
    content: expressionContent(),
    position: { x: 0, y: 0 },
    ...extra,
  }) as unknown as DecisionNode;

const dedge = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    sourceId: 'a',
    targetId: 'b',
    ...extra,
  }) as unknown as DecisionEdge;

describe('addStrikethrough', () => {
  it('returns an empty string for empty and missing input', () => {
    expect(addStrikethrough('')).toBe('');
    expect(addStrikethrough(undefined)).toBe('');
  });

  it('marks every character', () => {
    expect(addStrikethrough('ab')).toBe('a\u0336b\u0336');
  });

  it('does not split astral characters (Array.from, not string indexing)', () => {
    // '😀' is a surrogate pair — a naive per-code-unit map would emit two
    // combining marks and split the glyph.
    expect(addStrikethrough('😀')).toBe('😀\u0336');
  });
});

describe('buildDiffString', () => {
  it('joins the struck-through previous value with the current one', () => {
    expect(buildDiffString('new', 'old')).toBe('o\u0336l\u0336d\u0336 -> new');
  });
});

describe('compareStringFields', () => {
  it('treats missing values as empty', () => {
    expect(compareStringFields(undefined, undefined)).toBe(true);
    expect(compareStringFields(null, '')).toBe(true);
    expect(compareStringFields('a', undefined)).toBe(false);
  });

  it('trims before comparing', () => {
    expect(compareStringFields('  a  ', 'a')).toBe(true);
    expect(compareStringFields('a', 'b')).toBe(false);
  });
});

describe('compareAndUnifyLists', () => {
  // the unifier adds a `_diff` to every item it returns
  type Item = { id?: string; _id?: string; value?: unknown; _diff?: Record<string, unknown> };

  it('marks new items as added', () => {
    const result = compareAndUnifyLists<Item>([{ id: 'a' }, { id: 'b' }], [{ id: 'a' }]);
    expect(result.find((item) => item.id === 'b')?._diff).toEqual({ status: 'added', newIndex: 1 });
  });

  it('marks items missing from the new list as removed', () => {
    const result = compareAndUnifyLists<Item>([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }]);
    expect(result.find((item) => item.id === 'b')?._diff).toEqual({ status: 'removed', previousIndex: 1 });
  });

  it('marks unchanged items as unchanged', () => {
    const result = compareAndUnifyLists<Item>([{ id: 'a' }], [{ id: 'a' }]);
    expect(result[0]._diff).toEqual({ status: 'unchanged' });
  });

  it('reports a real position change, ignoring insertion/removal shifts', () => {
    // 'b' moved from index 1 to index 0 — a genuine reorder.
    const reordered = compareAndUnifyLists<Item>([{ id: 'b' }, { id: 'a' }], [{ id: 'a' }, { id: 'b' }]);
    expect(reordered.find((item) => item.id === 'b')?._diff).toMatchObject({
      status: 'modified',
      positionChanged: true,
    });

    // 'b' shifted from index 1 to index 2 only because 'c' was inserted
    // before it — that is not a real position change, so the item stays
    // unchanged rather than being flagged as modified.
    const shifted = compareAndUnifyLists<Item>([{ id: 'c' }, { id: 'a' }, { id: 'b' }], [{ id: 'a' }, { id: 'b' }]);
    expect(shifted.find((item) => item.id === 'b')?._diff).toEqual({ status: 'unchanged' });
  });

  it('supports the _id field', () => {
    const result = compareAndUnifyLists<Item>([{ _id: 'a' }], [{ _id: 'a' }], { idField: '_id' });
    expect(result[0]._diff).toEqual({ status: 'unchanged' });
  });

  it('uses compareFields to detect content changes', () => {
    const result = compareAndUnifyLists<Item>([{ id: 'a', value: 2 }], [{ id: 'a', value: 1 }], {
      compareFields: (current, previous) => ({
        hasChanges: current.value !== previous.value,
        fields: { value: { status: 'modified', previousValue: previous.value } },
      }),
    });

    expect(result[0]._diff).toMatchObject({
      status: 'modified',
      positionChanged: false,
      fields: { value: { status: 'modified', previousValue: 1 } },
    });
  });
});

describe('processNodes', () => {
  it('marks a node that only exists in the current graph as added', () => {
    const [node] = processNodes([dnode('a')], []);
    expect(node._diff).toEqual({ status: 'added' });
  });

  it('marks a node that only exists in the previous graph as removed', () => {
    const [node] = processNodes([], [dnode('a')]);
    expect(node._diff).toEqual({ status: 'removed' });
  });

  it('marks an identical node as unchanged', () => {
    const [node] = processNodes([dnode('a')], [dnode('a')]);
    expect(node._diff).toEqual({ status: 'unchanged' });
  });

  it('reports a moved node as moved', () => {
    const [node] = processNodes([dnode('a', { position: { x: 10, y: 10 } })], [dnode('a')]);
    expect(node._diff).toMatchObject({ status: 'moved' });
    expect(node._diff?.fields?.position).toMatchObject({ status: 'moved' });
  });

  it('reports a renamed node as modified', () => {
    const [node] = processNodes([dnode('a', { name: 'renamed' })], [dnode('a')]);
    expect(node._diff).toMatchObject({ status: 'modified' });
    expect(node._diff?.fields?.name).toMatchObject({ status: 'modified', previousValue: 'a' });
  });

  it('delegates the content diff to a custom component', () => {
    const component = {
      type: 'customThing',
      getDiffContent: (current: string, previous: string) => ({
        value: current,
        _diff: { status: 'modified', fields: { value: { status: 'modified', previousValue: previous } } },
      }),
    } as never;

    const [node] = processNodes(
      [dnode('a', { type: 'customThing', content: 'new' })],
      [dnode('a', { type: 'customThing', content: 'old' })],
      { components: [component], customNodes: [] },
    );

    expect(node._diff).toMatchObject({ status: 'modified' });
    expect(node.content).toMatchObject({ value: 'new' });
  });
});

describe('processEdges', () => {
  it('marks new, unchanged and removed edges', () => {
    expect(processEdges([dedge('e1')], [])[0]._diff).toEqual({ status: 'added' });
    expect(processEdges([dedge('e1')], [dedge('e1')])[0]._diff).toEqual({ status: 'unchanged' });
    expect(processEdges([], [dedge('e1')])[0]._diff).toEqual({ status: 'removed' });
  });
});

describe('calculateDiffGraph', () => {
  it('diffs nodes and edges together', () => {
    const current = { nodes: [dnode('a'), dnode('b')], edges: [dedge('e1')] };
    const previous = { nodes: [dnode('a')], edges: [] };

    const result = calculateDiffGraph(current, previous);

    expect(result.nodes.map((n) => [n.id, n._diff?.status])).toEqual([
      ['a', 'unchanged'],
      ['b', 'added'],
    ]);
    expect(result.edges.map((e) => [e.id, e._diff?.status])).toEqual([['e1', 'added']]);
  });

  it('tolerates missing graphs', () => {
    const result = calculateDiffGraph(undefined as never, undefined as never);
    expect(result).toEqual({ nodes: [], edges: [] });
  });
});
