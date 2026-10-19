// @vitest-environment jsdom
// Logic-core coverage for zen.ts's completion/hover extensions (PORTING.md
// testing rule, module #4). makeExpressionCompletion, autoCompleteSpan and
// hoverSpan are module-private, so the node-kind dispatch is exercised
// through the exported completionExtension()/hoverExtension() on a real
// EditorView: explicit queries via startCompletion(), implicit ones via
// input.type transactions, results read from currentCompletions() and the
// rendered tooltip DOM. The wasm engine is initialised synchronously from
// the package's .wasm asset (same pattern as extensions.test.ts), which the
// completion options and the typeField spans depend on.
import { currentCompletions, startCompletion } from '@codemirror/autocomplete';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createVariableType, initSync } from '@gorules/zen-engine-wasm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { typeField, updateVariableTypeEffect } from './types';
import { completionExtension, hoverExtension, zenExtensions } from './zen';

// startCompletion() debounces the query by 50ms and typed activation by
// 100ms; hover waits hoverTime (700ms). Real timers with a generous sleep
// keep this deterministic — the only requirement is that they have fired.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const completionSettle = () => sleep(300);
const hoverSettle = () => sleep(1100);

const views: EditorView[] = [];

const createZenView = ({ doc, pos, extensions = [] }: { doc: string; pos: number; extensions?: Extension[] }) => {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: { anchor: pos },
      extensions: [zenExtensions({ type: 'standard', lazy: true }), typeField, ...extensions],
    }),
  });
  views.push(view);
  return view;
};

const setRootType = (view: EditorView, variableType: unknown) =>
  view.dispatch({ effects: updateVariableTypeEffect.of(createVariableType(variableType as never)) });

const completionLabels = (view: EditorView) => currentCompletions(view.state).map((c) => c.label);

describe('zen/makeExpressionCompletion dispatch', () => {
  beforeAll(() => {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve('@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm');
    initSync({ module: readFileSync(wasmPath) });
  });

  afterEach(() => {
    while (views.length) {
      views.pop()?.destroy();
    }
    document.body.innerHTML = '';
  });

  it('completes root variables and top-level functions on a Standard node', async () => {
    const view = createZenView({ doc: 'a', pos: 0, extensions: [completionExtension()] });
    setRootType(view, { Object: { a: { Object: { b: 'Number' } } } });

    startCompletion(view);
    await completionSettle();

    const completions = currentCompletions(view.state);
    expect(completions).toContainEqual(expect.objectContaining({ label: 'a', type: 'variable' }));
    expect(completions).toContainEqual(expect.objectContaining({ label: 'len', type: 'function' }));
    // Nested properties are not offered at the root, only root variables.
    expect(completions.find((c) => c.label === 'b')).toBeUndefined();
  });

  it('completes the same variable/function list on a VariableName node', async () => {
    const view = createZenView({ doc: 'a', pos: 1, extensions: [completionExtension()] });
    setRootType(view, { Object: { a: 'String' } });

    startCompletion(view);
    await completionSettle();

    // The word under the caret is `a`, so CodeMirror filters the returned
    // options by that prefix via validFor: the variable `a` and `abs`
    // survive, `len` does not.
    const labels = completionLabels(view);
    expect(labels).toContain('a');
    expect(labels).toContain('abs');
    expect(labels).not.toContain('len');
  });

  it('completes variables and functions right after an opening bracket', async () => {
    const view = createZenView({ doc: '[', pos: 1, extensions: [completionExtension()] });
    setRootType(view, { Object: { a: 'String' } });

    startCompletion(view);
    await completionSettle();

    expect(completionLabels(view)).toContain('a');
    expect(completionLabels(view)).toContain('len');
  });

  it('completes the base expression properties after a dot (autoCompleteSpan)', async () => {
    const view = createZenView({ doc: 'a.', pos: 2, extensions: [completionExtension()] });
    setRootType(view, { Object: { a: { Object: { b: 'Number' } } } });

    startCompletion(view);
    await completionSettle();

    // The span resolves to the base identifier `a`, so the options are the
    // properties of a's object kind — not the top-level variable list.
    const completions = currentCompletions(view.state);
    expect(completions).toHaveLength(1);
    expect(completions[0]).toMatchObject({ label: 'b', type: 'property', detail: 'number', boost: 50 });
  });

  it('keeps completing base properties while the property name is typed', async () => {
    const view = createZenView({ doc: 'a.b', pos: 3, extensions: [completionExtension()] });
    setRootType(view, { Object: { a: { Object: { b: 'Number' } } } });

    startCompletion(view);
    await completionSettle();

    expect(completionLabels(view)).toEqual(['b']);
  });

  it('returns nothing for a non-object base kind', async () => {
    const view = createZenView({ doc: 'a.', pos: 2, extensions: [completionExtension()] });
    setRootType(view, { Object: { a: 'String' } });

    startCompletion(view);
    await completionSettle();

    expect(currentCompletions(view.state)).toEqual([]);
  });

  it('offers date methods when the base expression is a date', async () => {
    const view = createZenView({ doc: 'd("2026-01-01").', pos: 16, extensions: [completionExtension()] });
    setRootType(view, { Object: {} });

    startCompletion(view);
    await completionSettle();

    const completions = currentCompletions(view.state);
    const labels = completions.map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['format', 'startOf', 'endOf', 'diff', 'tz', 'isAfter']));
    // Only Date methods: no top-level functions or variables mix in.
    expect(completions.every((c) => c.type === 'method')).toBe(true);
    expect(labels).not.toContain('abs');
    expect(labels).not.toContain('len');
  });

  it('narrows date methods to the typed prefix', async () => {
    const view = createZenView({ doc: 'd("2026-01-01").f', pos: 17, extensions: [completionExtension()] });
    setRootType(view, { Object: {} });

    startCompletion(view);
    await completionSettle();

    expect(completionLabels(view)).toEqual(['format']);
  });

  it('returns nothing inside an unfinished string with no matching type span', async () => {
    const view = createZenView({ doc: 'a == "bl', pos: 8, extensions: [completionExtension()] });
    setRootType(view, { Object: { a: { Enum: [undefined, ['blue', 'black']] } } });

    startCompletion(view);
    await completionSettle();

    expect(currentCompletions(view.state)).toEqual([]);
  });

  it('returns nothing when the cursor sits on an unmatched node', async () => {
    const view = createZenView({ doc: 'a + ', pos: 4, extensions: [completionExtension()] });
    setRootType(view, { Object: { a: 'String' } });

    startCompletion(view);
    await completionSettle();

    expect(currentCompletions(view.state)).toEqual([]);
  });

  it('activates on typing a dot without an explicit trigger', async () => {
    // Non-explicit activation normally requires a word at the cursor; a
    // freshly typed '.' is the exception the guard allows through.
    const view = createZenView({ doc: 'a', pos: 1, extensions: [completionExtension()] });
    setRootType(view, { Object: { a: { Object: { b: 'Number' } } } });

    view.dispatch({ changes: { from: 1, insert: '.' }, selection: { anchor: 2 }, userEvent: 'input.type' });
    await completionSettle();

    expect(completionLabels(view)).toEqual(['b']);
  });
});

describe('zen/hoverExtension', () => {
  beforeAll(() => {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve('@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm');
    initSync({ module: readFileSync(wasmPath) });

    // jsdom does not implement Range.getClientRects; CodeMirror's
    // coordsAtPos (used by hoverTooltip before the source runs) needs it.
    const rangeProto = document.createRange().constructor.prototype as unknown as Record<string, unknown>;
    if (typeof rangeProto.getClientRects !== 'function') {
      rangeProto.getClientRects = () => [{ left: 0, top: 0, right: 10, bottom: 16, width: 10, height: 16 }];
    }
    if (typeof rangeProto.getBoundingClientRect !== 'function') {
      rangeProto.getBoundingClientRect = () => ({ left: 0, top: 0, right: 10, bottom: 16, width: 10, height: 16 });
    }
  });

  afterEach(() => {
    while (views.length) {
      views.pop()?.destroy();
    }
    document.body.innerHTML = '';
  });

  it('shows the resolved type over the hovered property chain (hoverSpan)', async () => {
    const view = createZenView({ doc: 'a.b', pos: 3, extensions: [hoverExtension()] });
    setRootType(view, { Object: { a: { Object: { b: 'Number' } } } });

    view.contentDOM.dispatchEvent(new MouseEvent('mousemove', { clientX: 1, clientY: 1, bubbles: true }));
    await hoverSettle();

    const tooltip = view.dom.querySelector<HTMLElement>('.grl-ce-hover-tooltip');
    // hoverSpan covers the whole chain `a.b`, typed as number by the span lookup.
    expect(tooltip?.textContent).toContain('a.b: number');
  });

  it('shows the signature of a known function name', async () => {
    const view = createZenView({ doc: 'abs(1)', pos: 3, extensions: [hoverExtension()] });

    view.contentDOM.dispatchEvent(new MouseEvent('mousemove', { clientX: 1, clientY: 1, bubbles: true }));
    await hoverSettle();

    const tooltip = view.dom.querySelector<HTMLElement>('.grl-ce-hover-tooltip');
    expect(tooltip?.textContent).toContain('abs: (num: number) -> number');
    expect(tooltip?.textContent).toContain('Returns the absolute value of a number');
  });
});
