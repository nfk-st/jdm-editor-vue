// @vitest-environment jsdom
// The custom node's form values (PORTING: antd's rc-field-form store).
//
// Upstream's <Form.Item name='hello.nested.something'> keeps the value
// NESTED in the node's config, and only the registered inputs survive an
// edit. The port read the flat key and wrote with lodash's `_.set`, which
// nests a name that is not already a key — and then wrote into the immer-
// frozen object on the next edit, so the edit was silently lost.
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';

import { collectInputValues, setFormValue } from './index';

describe('custom node form values', () => {
  it('reads a dotted name from a flat config', () => {
    const values = collectInputValues({ 'hello.nested.something': 'My', 'second': 'Name' }, [
      'hello.nested.something',
      'second',
    ]);

    expect(values).toEqual({ hello: { nested: { something: 'My' } }, second: 'Name' });
  });

  it('reads a dotted name from a nested config', () => {
    const values = collectInputValues({ hello: { nested: { something: 'My' } } }, ['hello.nested.something']);

    expect(values).toEqual({ hello: { nested: { something: 'My' } } });
  });

  it('keeps only the registered inputs', () => {
    const values = collectInputValues({ 'hello.nested.something': 'My', 'other': 'dropped' }, [
      'hello.nested.something',
    ]);

    expect(values).toEqual({ hello: { nested: { something: 'My' } } });
  });

  it('writes into a frozen config without losing the edit', () => {
    // the store freezes what immer produced — a write into the frozen
    // object is silently dropped
    const frozen = produce<{ config: Record<string, unknown> }>({ config: {} }, (draft) => {
      draft.config = { second: 'Name' };
    });

    const first = setFormValue({ ...frozen.config }, 'hello.nested.something', 'My');
    expect(first).toEqual({ second: 'Name', hello: { nested: { something: 'My' } } });

    // the store freezes that too
    const frozenAgain = produce<{ config: Record<string, unknown> }>({ config: {} }, (draft) => {
      draft.config = first;
    });

    const second = setFormValue({ ...frozenAgain.config }, 'hello.nested.something', 'Bye');
    expect(second).toEqual({ second: 'Name', hello: { nested: { something: 'Bye' } } });
    // the frozen object was not touched
    expect((frozenAgain.config as Record<string, unknown>).hello).toEqual({ nested: { something: 'My' } });
  });
});
