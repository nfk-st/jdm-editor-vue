// @vitest-environment jsdom
// Logic-core coverage for code-editor/extensions (PORTING.md testing rule —
// module #4). The wasm-backed cases init the engine synchronously from the
// package's .wasm asset (same singleton @gorules/zen-engine-wasm exports).
import type { Completion } from '@codemirror/autocomplete';
import { EditorState, type Text } from '@codemirror/state';
import { initSync } from '@gorules/zen-engine-wasm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { getCompletions } from './completion';
import { escapeHtml, renderDiagnosticMessage } from './diagnostic';
import { validateZenExpression, zenLinter } from './linter';
import type { ZenType } from './types';
import {
  buildTypeCompletion,
  typeField,
  updateExpressionTypeEffect,
  updateStrictModeEffect,
  updateVariableTypeEffect,
  zenKindToString,
} from './types';
import { applyCompletion, zenExtensions } from './zen';

describe('diagnostic/renderDiagnosticMessage', () => {
  it('colors strings, numbers and everything else differently', () => {
    const stringMsg = renderDiagnosticMessage({ text: 'got `"foo"`', className: 'token' });
    expect(stringMsg).toContain('#6aab73');
    expect(stringMsg).toContain('class="token"');

    const numberMsg = renderDiagnosticMessage({ text: 'got `42`' });
    expect(numberMsg).toContain('#57a8f5');

    const otherMsg = renderDiagnosticMessage({ text: 'got `bar`' });
    expect(otherMsg).toContain('#CE8E6D');
  });

  it('leaves text without backticks untouched', () => {
    expect(renderDiagnosticMessage({ text: 'plain message' })).toBe('plain message');
  });

  it('escapes html inside backticked content', () => {
    const msg = renderDiagnosticMessage({ text: 'a `<script>`' });
    expect(msg).not.toContain('<script>');
    expect(msg).toContain('&lt;script&gt;');
  });
});

describe('diagnostic/escapeHtml', () => {
  it('escapes the five html-sensitive characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#039;');
  });
});

describe('completion/getCompletions', () => {
  // Must run before the wasm-backed describe initialises the engine below —
  // vitest executes describes in declaration order.
  it('returns an empty list while wasm is not available', () => {
    expect(getCompletions()).toEqual([]);
  });
});

describe('types/zenKindToString', () => {
  it('maps kinds to their display strings', () => {
    expect(zenKindToString('Bool')).toBe('bool');
    expect(zenKindToString('STRING')).toBe('string');
    expect(zenKindToString({ Object: { a: 'String' } })).toBe('object');
    expect(zenKindToString({ Array: 'Number' })).toBe('number[]');
    expect(zenKindToString({ Const: 'x' })).toBe('"x"');
    expect(zenKindToString({ Enum: ['a', 'b'] })).toBe('"a" | "b"');
    expect(zenKindToString(42)).toBe('unknown');
  });
});

describe('types/buildTypeCompletion', () => {
  it('builds property completions for object kinds', () => {
    const completions = buildTypeCompletion({ kind: { Object: { foo: 'String', bar: 'Number' } } });
    expect(completions).toHaveLength(2);
    expect(completions).toContainEqual(
      expect.objectContaining({ label: 'foo', type: 'property', boost: 50, detail: 'string', apply: applyCompletion }),
    );
  });

  it('returns an empty list for non-object kinds', () => {
    expect(buildTypeCompletion({ kind: 'String' })).toEqual([]);
  });
});

describe('types/typeField', () => {
  it('applies strict-mode and expression-type effects', () => {
    let state = EditorState.create({ doc: '1', extensions: [typeField] });
    expect(state.field(typeField).strict).toBe(false);
    expect(state.field(typeField).expressionType).toBe('standard');

    state = state.update({ effects: [updateStrictModeEffect.of(true), updateExpressionTypeEffect.of('unary')] }).state;
    expect(state.field(typeField).strict).toBe(true);
    expect(state.field(typeField).expressionType).toBe('unary');
  });
});

describe('zen/applyCompletion', () => {
  const makeView = (doc: string) => {
    const state = EditorState.create({ doc });
    const dispatch = vi.fn();
    return { view: { state, dispatch } as any, dispatch };
  };

  const insertedText = (transaction: any): string => {
    let inserted = '';
    transaction.changes.iterChanges((_fromA: number, _toA: number, _fromB: number, _toB: number, text: Text) => {
      inserted += text.toString();
    });
    return inserted;
  };

  it('appends parentheses and places the caret inside for functions', () => {
    const { view, dispatch } = makeView('foo');
    const completion = { label: 'len', type: 'function' } as Completion;

    applyCompletion(view, completion, 0, 3);

    expect(dispatch).toHaveBeenCalledTimes(1);
    const transaction = dispatch.mock.calls[0][0];
    expect(insertedText(transaction)).toBe('len()');
    expect(transaction.selection.main.anchor).toBe('len('.length);
  });

  it('inserts the label and places the caret after it otherwise', () => {
    const { view, dispatch } = makeView('foo');
    const completion = { label: 'bar', type: 'variable' } as Completion;

    applyCompletion(view, completion, 0, 3);

    const transaction = dispatch.mock.calls[0][0];
    expect(insertedText(transaction)).toBe('bar');
    expect(transaction.selection.main.anchor).toBe(3);
  });
});

describe('zen/zenExtensions', () => {
  it('returns only the language when lazy', () => {
    expect(zenExtensions({ type: 'standard', lazy: true })).toHaveLength(1);
    expect(zenExtensions({ type: 'template', lazy: true })).toHaveLength(1);
  });

  it('returns the full extension set when not lazy', () => {
    // language, completion, hover, closeBrackets, linter, typeField, history, keymap
    expect(zenExtensions({ type: 'standard' })).toHaveLength(8);
    expect(zenExtensions({ type: 'standard', lint: false })).toHaveLength(7);
  });
});

describe('linter/zenLinter', () => {
  it('returns a CodeMirror linter extension', () => {
    expect(zenLinter('standard')).toBeTruthy();
  });
});

describe('wasm-backed extensions', () => {
  beforeAll(() => {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve('@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm');
    initSync({ module: readFileSync(wasmPath) });
  });

  it('completion/getCompletions returns the engine completions once ready', () => {
    // The local Completion type models the wasm payload loosely — the engine
    // also returns `type`/`methodFor`, exercised via the widened type here.
    const completions = getCompletions() as Array<{ type?: string; label: string }>;
    expect(completions.length).toBeGreaterThan(50);
    expect(completions.some((c) => c.type === 'function')).toBe(true);
    expect(completions.every((c) => typeof c.label === 'string')).toBe(true);
  });

  it('validateZenExpression returns no diagnostics for empty or valid sources', () => {
    expect(validateZenExpression({ source: '   ', types: [] })).toEqual([]);
    expect(validateZenExpression({ source: '1 + 1', types: [] })).toEqual([]);
  });

  it('validateZenExpression surfaces parser errors with their position', () => {
    const diagnostics = validateZenExpression({ source: '1 +', types: [] });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      from: 3,
      to: 3,
      severity: 'error',
      source: 'Parser error',
      message: 'Unexpected end of unary expression at (3, 3)',
    });
  });

  it('validateZenExpression surfaces lexer errors with a single position', () => {
    const diagnostics = validateZenExpression({ source: '"unclosed', types: [] });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      from: 8,
      to: 8,
      severity: 'error',
      source: 'Lexer error',
    });
  });

  it('maps type errors onto hint/info/warning severities', () => {
    const types: ZenType[] = [
      { error: 'Hint: something', kind: 'Any', nodeKind: 'Member', span: [0, 1] },
      { error: 'Info: something', kind: 'Any', nodeKind: 'Member', span: [1, 2] },
      { error: 'Unmatched type', kind: 'Any', nodeKind: 'Member', span: [2, 3] },
      { error: null, kind: 'Any', nodeKind: 'Member', span: [3, 3] },
    ];
    const diagnostics = validateZenExpression({ source: 'foo', types });

    expect(diagnostics).toHaveLength(3);
    expect(diagnostics.map((d) => d.severity)).toEqual(['hint', 'info', 'warning']);
    expect(diagnostics.every((d) => d.source === 'Type check')).toBe(true);
    expect(diagnostics[0]).toMatchObject({ from: 0, to: 1, message: 'Hint: something' });
    // createDiagnostic attaches the rendered (token-coloured) message builder.
    expect(diagnostics.every((d) => typeof d.renderMessage === 'function')).toBe(true);
  });

  it('flags unary expressions that do not evaluate to bool', () => {
    const types: ZenType[] = [{ error: null, kind: 'String', nodeKind: 'Identifier', span: [0, 3] }];
    const warning = validateZenExpression({ source: 'foo', expressionType: 'unary', types });
    expect(warning).toHaveLength(1);
    expect(warning[0]).toMatchObject({ severity: 'warning', source: 'Type check' });
    expect(warning[0].message).toContain('`bool`');
    expect(warning[0].message).toContain('`string`');

    const error = validateZenExpression({ source: 'foo', expressionType: 'unary', strict: true, types });
    expect(error[0].severity).toBe('error');
  });

  it('compares the result kind against the expected variable type', async () => {
    const { VariableType } = await import('@gorules/zen-engine-wasm');
    const types: ZenType[] = [{ error: null, kind: 'String', nodeKind: 'Identifier', span: [0, 3] }];

    const mismatch = validateZenExpression({
      source: 'foo',
      expectedVariableType: VariableType.fromJson('Bool'),
      types,
    });
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0].severity).toBe('warning');
    expect(mismatch[0].message).toContain('Expected expression to evaluate to type `bool`, received `string`');

    const satisfied = validateZenExpression({
      source: 'foo',
      expectedVariableType: VariableType.fromJson('Bool'),
      types: [{ error: null, kind: 'Bool', nodeKind: 'Identifier', span: [0, 3] }],
    });
    expect(satisfied).toEqual([]);
  });

  it('treats Any as a mismatch when strict', async () => {
    const { VariableType } = await import('@gorules/zen-engine-wasm');

    const diagnostics = validateZenExpression({
      source: 'foo',
      strict: true,
      expectedVariableType: VariableType.fromJson('Bool'),
      types: [{ error: null, kind: 'Any', nodeKind: 'Identifier', span: [0, 3] }],
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('error');
  });

  it('typeField computes types from a variable type effect', async () => {
    const { createVariableType } = await import('@gorules/zen-engine-wasm');

    const variableType = createVariableType({ Object: { a: 'String' } });
    let state = EditorState.create({ doc: 'a', extensions: [typeField] });

    state = state.update({
      changes: { from: 0, to: 1, insert: 'a.b' },
      effects: updateVariableTypeEffect.of(variableType),
    }).state;

    const field = state.field(typeField);
    expect(field.source).toBe('a.b');
    expect(field.root).toBe(variableType);
    expect(field.rootKind).toEqual({ Object: { a: 'String' } });
    expect(field.types.length).toBeGreaterThan(0);
    expect(field.types[0]).toMatchObject({ nodeKind: 'Member' });
  });
});
