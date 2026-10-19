// @vitest-environment jsdom
// Logic-core coverage for components/business (PORTING.md testing rule).
// The wasm-backed cases init the engine synchronously from the package's
// .wasm asset, same as components/code-editor/extensions' tests.
import { initSync, parseStandardExpression } from '@gorules/zen-engine-wasm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { focusBuilderRoot } from './focus-helper';
import {
  defaultValue,
  enumFilterOption,
  getEnumOptions,
  getValueKind,
  inferKindFromExpr,
  isExprCompatibleWithKind,
} from './expression-builder.vue';
import {
  formatDateValue,
  formatStringArrayValue,
  formatStringValue,
  isStringArrayValue,
  parseStringArrayValue,
} from './standard-expression-builder.vue';

describe('focus-helper/focusBuilderRoot', () => {
  it('focuses the CodeMirror view attached to a .grl-ce element and moves the cursor to the end', () => {
    const view = {
      focus: vi.fn(),
      dispatch: vi.fn(),
      state: { doc: { length: 7 } },
    };
    const root = document.createElement('div');
    const ce = document.createElement('div');
    ce.className = 'grl-ce';
    (ce as unknown as { codeMirror: unknown }).codeMirror = view;
    root.appendChild(ce);
    document.body.appendChild(root);

    focusBuilderRoot(root);

    expect(view.focus).toHaveBeenCalledOnce();
    expect(view.dispatch).toHaveBeenCalledWith({ selection: { anchor: 7 } });
  });

  it('falls back to the first input and selects to the end', () => {
    const root = document.createElement('div');
    const input = document.createElement('input');
    input.value = 'abc';
    root.appendChild(input);
    document.body.appendChild(root);

    focusBuilderRoot(root);

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(3);
  });

  it('does nothing for a null element', () => {
    expect(() => focusBuilderRoot(null)).not.toThrow();
  });
});

describe('expression-builder pure logic', () => {
  it('getValueKind maps field types onto value kinds', () => {
    expect(getValueKind(undefined)).toBe('any');
    expect(getValueKind({ type: 'string' })).toBe('string');
    expect(getValueKind({ type: 'number' })).toBe('number');
    expect(getValueKind({ type: 'boolean' })).toBe('boolean');
    expect(getValueKind({ type: 'date' })).toBe('date');
  });

  it('enumFilterOption matches label and value case-insensitively', () => {
    const option = { label: 'Gold Tier', value: 'gold' };
    expect(enumFilterOption('gold', option)).toBe(true);
    expect(enumFilterOption('TIER', option)).toBe(true);
    expect(enumFilterOption('silver', option)).toBe(false);
    expect(enumFilterOption('gold', undefined)).toBe(false);
  });

  it('getEnumOptions resolves inline and dictionary-backed enums', () => {
    expect(getEnumOptions({ type: 'number' })).toBeNull();
    expect(getEnumOptions({ type: 'string' })).toBeNull();
    expect(getEnumOptions({ type: 'string', enum: { type: 'inline', values: [] } })).toBeNull();
    expect(getEnumOptions({ type: 'string', enum: { type: 'inline', values: [{ label: 'A', value: 'a' }] } })).toEqual({
      values: [{ label: 'A', value: 'a' }],
      loose: false,
    });
    expect(
      getEnumOptions(
        { type: 'string', enum: { type: 'ref', ref: 'tiers', loose: true } },
        { tiers: [{ label: 'A', value: 'a' }] },
      ),
    ).toEqual({ values: [{ label: 'A', value: 'a' }], loose: true });
    expect(getEnumOptions({ type: 'string', enum: { type: 'ref', ref: 'missing' } }, {})).toBeNull();
  });

  it('defaultValue builds per-operator values', () => {
    expect(defaultValue('null', 'string')).toBeNull();
    expect(defaultValue('any', 'string')).toBeNull();
    expect(defaultValue('dateIsToday', 'date')).toBeNull();
    expect(defaultValue('between', 'number')).toEqual({
      type: 'interval',
      left: 0,
      right: 100,
      leftInclusive: true,
      rightInclusive: true,
    });
    expect(defaultValue('in', 'number')).toEqual({ type: 'numberArray', values: [] });
    expect(defaultValue('in', 'string')).toEqual({ type: 'stringArray', values: [] });
    expect(defaultValue('timeGt', 'date')).toEqual({ type: 'time', hour: 9, minute: 0 });
    expect(defaultValue('dayOfWeekIn', 'date')).toEqual({ type: 'intArray', values: [1, 2, 3, 4, 5] });
    expect(defaultValue('quarterIn', 'date')).toEqual({ type: 'intArray', values: [1] });
    expect(defaultValue('startsWith', 'string')).toEqual({ type: 'string', value: '' });
    expect(defaultValue('eq', 'number')).toEqual({ type: 'number', value: 0 });
    expect(defaultValue('eq', 'boolean')).toEqual({ type: 'boolean', value: true });
    expect(defaultValue('eq', 'any')).toEqual({ type: 'string', value: '' });
    expect(defaultValue('dateAfter', 'date')).toEqual({
      type: 'date',
      value: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('inferKindFromExpr reads the kind off a simple expression', () => {
    expect(inferKindFromExpr({ kind: 'complex', raw: 'a > b' })).toBeNull();
    expect(inferKindFromExpr({ kind: 'simple', operator: { type: 'dateAfter' }, value: null })).toBe('date');
    expect(inferKindFromExpr({ kind: 'simple', operator: { type: 'contains' }, value: null })).toBe('string');
    expect(inferKindFromExpr({ kind: 'simple', operator: { type: 'eq' }, value: null })).toBeNull();
    expect(
      inferKindFromExpr({ kind: 'simple', operator: { type: 'eq' }, value: { type: 'boolean', value: true } }),
    ).toBe('boolean');
    expect(
      inferKindFromExpr({ kind: 'simple', operator: { type: 'eq' }, value: { type: 'numberArray', values: [1] } }),
    ).toBe('number');
    expect(
      inferKindFromExpr({
        kind: 'simple',
        operator: { type: 'eq' },
        value: { type: 'time', hour: 1, minute: 2 },
      }),
    ).toBe('date');
  });

  it('isExprCompatibleWithKind checks operator and value shape', () => {
    expect(isExprCompatibleWithKind({ kind: 'complex', raw: 'a' }, 'string')).toBe(true);
    expect(
      isExprCompatibleWithKind({ kind: 'simple', operator: { type: 'between' }, value: null }, 'boolean'),
    ).toBe(false);
    expect(isExprCompatibleWithKind({ kind: 'simple', operator: { type: 'null' }, value: null }, 'string')).toBe(true);
    expect(isExprCompatibleWithKind({ kind: 'simple', operator: { type: 'eq' }, value: null }, 'boolean')).toBe(true);
    expect(
      isExprCompatibleWithKind(
        { kind: 'simple', operator: { type: 'eq' }, value: { type: 'string', value: 'x' } },
        'boolean',
      ),
    ).toBe(false);
    expect(
      isExprCompatibleWithKind(
        { kind: 'simple', operator: { type: 'eq' }, value: { type: 'string', value: 'x' } },
        'string',
      ),
    ).toBe(true);
    expect(
      isExprCompatibleWithKind(
        { kind: 'simple', operator: { type: 'in' }, value: { type: 'numberArray', values: [] } },
        'number',
      ),
    ).toBe(true);
    expect(
      isExprCompatibleWithKind(
        { kind: 'simple', operator: { type: 'dayOfWeekIn' }, value: { type: 'intArray', values: [1] } },
        'date',
      ),
    ).toBe(true);
    expect(
      isExprCompatibleWithKind(
        { kind: 'simple', operator: { type: 'eq' }, value: { type: 'date', value: '2026-01-01' } },
        'any',
      ),
    ).toBe(true);
  });
});

describe('standard-expression-builder pure logic', () => {
  it('formats values as zen expressions', () => {
    expect(formatDateValue('2026-05-13')).toBe("d('2026-05-13')");
    expect(formatStringValue('hi')).toBe('"hi"');
    expect(formatStringArrayValue([])).toBe('[]');
    expect(formatStringArrayValue(['a', 'b'])).toBe('["a", "b"]');
    expect(formatStringArrayValue(['a"b'])).toBe('["a\\"b"]');
  });

  it('parses and detects string-array values', () => {
    expect(parseStringArrayValue('')).toEqual([]);
    expect(parseStringArrayValue('[]')).toEqual([]);
    expect(parseStringArrayValue('["a","b"]')).toEqual(['a', 'b']);
    expect(parseStringArrayValue('not json')).toEqual([]);
    expect(parseStringArrayValue('[1,2]')).toEqual(['1', '2']);

    expect(isStringArrayValue('')).toBe(true);
    expect(isStringArrayValue('[]')).toBe(true);
    expect(isStringArrayValue('["a"]')).toBe(true);
    expect(isStringArrayValue('"a"')).toBe(false);
    expect(isStringArrayValue('{ }')).toBe(false);
  });
});

describe('wasm-backed parse/render glue', () => {
  beforeAll(() => {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve('@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm');
    initSync({ module: readFileSync(wasmPath) });
  });

  it('parseStandardExpression recognises the kinds the builder switches on', () => {
    expect(parseStandardExpression('"hello"')).toEqual({ kind: 'string', value: 'hello' });
    expect(parseStandardExpression('42')).toEqual({ kind: 'number', value: 42 });
    expect(parseStandardExpression('true')).toEqual({ kind: 'boolean', value: true });
    expect(parseStandardExpression("d('2026-05-13')")).toEqual({ kind: 'date', value: '2026-05-13' });
    expect(parseStandardExpression('a + b')).toEqual({ kind: 'expression' });
  });

  it('string-array values round-trip through format/parse', () => {
    const formatted = formatStringArrayValue(['x', 'y']);
    expect(parseStringArrayValue(formatted)).toEqual(['x', 'y']);
    expect(isStringArrayValue(formatted)).toBe(true);
  });
});
