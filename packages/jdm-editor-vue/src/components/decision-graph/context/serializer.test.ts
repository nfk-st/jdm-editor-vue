// @vitest-environment jsdom
// Logic-core coverage for the decision-graph serializer registry
// (PORTING.md's testing rule): graph/tab slice registration, snapshot
// round-trips, the pending-restore path (a snapshot restored before its
// slice mounts) and the error isolation around a throwing slice.
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { type VNode, defineComponent, h, nextTick, ref } from 'vue';

import {
  type DecisionGraphSnapshot,
  SerializerProvider,
  useGraphSerializer,
  useSerializerRegistry,
  useTabSerializer,
} from './serializer.context';

type Registry = ReturnType<typeof SerializerProvider>;

/** Mounts a component tree under a fresh serializer provider. */
const mountWith = (child: () => VNode | null) => {
  let registry: Registry | null = null;

  const wrapper = mount(
    defineComponent({
      setup() {
        registry = SerializerProvider();
        return () => h('div', [child()]);
      },
    }),
  );

  return { wrapper, registry: registry as unknown as Registry };
};

describe('serializer registry', () => {
  it('returns null when no provider is mounted', () => {
    let seen: Registry | null | undefined;
    mount(
      defineComponent({
        setup() {
          seen = useSerializerRegistry();
          return () => h('div');
        },
      }),
    );

    expect(seen).toBeNull();
  });

  it('serializes the registered graph slices', () => {
    const { registry } = mountWith(() =>
      h(
        defineComponent({
          setup() {
            useGraphSerializer('viewport', { serialize: () => ({ x: 1, y: 2, zoom: 3 }), restore: () => {} });
            useGraphSerializer('tabs', { serialize: () => ({ openTabs: [], activeTab: 'graph' }), restore: () => {} });
            return () => h('span');
          },
        }),
      ),
    );

    expect(registry.serialize()).toEqual({
      graph: {
        viewport: { x: 1, y: 2, zoom: 3 },
        tabs: { openTabs: [], activeTab: 'graph' },
      },
    });
  });

  it('omits a slice whose value is undefined', () => {
    const { registry } = mountWith(() =>
      h(
        defineComponent({
          setup() {
            useGraphSerializer('empty', { serialize: () => undefined, restore: () => {} });
            return () => h('span');
          },
        }),
      ),
    );

    expect(registry.serialize()).toEqual({});
  });

  it('restores into the registered slice', () => {
    const restored: unknown[] = [];

    const { registry } = mountWith(() =>
      h(
        defineComponent({
          setup() {
            useGraphSerializer('viewport', {
              serialize: () => null,
              restore: (value) => restored.push(value),
            });
            return () => h('span');
          },
        }),
      ),
    );

    registry.restore({ graph: { viewport: { zoom: 2 } } });

    expect(restored).toEqual([{ zoom: 2 }]);
  });

  it('holds a pending restore until the slice registers', async () => {
    const restored: unknown[] = [];
    const mounted = ref(false);

    const Slice = defineComponent({
      setup() {
        useGraphSerializer('viewport', {
          serialize: () => null,
          restore: (value) => restored.push(value),
        });
        return () => h('span');
      },
    });

    const { wrapper, registry } = mountWith(() => (mounted.value ? h(Slice) : null));

    // restored before the slice exists
    registry.restore({ graph: { viewport: { zoom: 9 } } });
    expect(restored).toEqual([]);

    // the slice mounts later and picks the pending value up
    mounted.value = true;
    await nextTick();
    expect(restored).toEqual([{ zoom: 9 }]);

    wrapper.unmount();
  });

  it('namespaces tab slices by tab id', () => {
    const { registry } = mountWith(() =>
      h(
        defineComponent({
          setup() {
            useTabSerializer('tab-1', 'monaco', { serialize: () => 'a', restore: () => {} });
            useTabSerializer('tab-2', 'monaco', { serialize: () => 'b', restore: () => {} });
            return () => h('span');
          },
        }),
      ),
    );

    expect(registry.serialize()).toEqual({ tabs: { 'tab-1': { monaco: 'a' }, 'tab-2': { monaco: 'b' } } });
  });

  it('drops a slice when its component unmounts', async () => {
    const mounted = ref(true);

    const Slice = defineComponent({
      setup() {
        useGraphSerializer('viewport', { serialize: () => 'a', restore: () => {} });
        return () => h('span');
      },
    });

    const { wrapper, registry } = mountWith(() => (mounted.value ? h(Slice) : null));

    expect(registry.serialize()).toEqual({ graph: { viewport: 'a' } });

    mounted.value = false;
    await nextTick();

    expect(registry.serialize()).toEqual({});

    wrapper.unmount();
  });

  it('isolates a slice that throws while serializing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { registry } = mountWith(() =>
      h(
        defineComponent({
          setup() {
            useGraphSerializer('broken', {
              serialize: () => {
                throw new Error('boom');
              },
              restore: () => {},
            });
            useGraphSerializer('fine', { serialize: () => 'ok', restore: () => {} });
            return () => h('span');
          },
        }),
      ),
    );

    expect(registry.serialize()).toEqual({ graph: { fine: 'ok' } });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('isolates a slice that throws while restoring', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { registry } = mountWith(() =>
      h(
        defineComponent({
          setup() {
            useGraphSerializer('broken', {
              serialize: () => null,
              restore: () => {
                throw new Error('boom');
              },
            });
            return () => h('span');
          },
        }),
      ),
    );

    expect(() => registry.restore({ graph: { broken: 'x' } })).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('round-trips a snapshot', () => {
    const { registry } = mountWith(() =>
      h(
        defineComponent({
          setup() {
            useGraphSerializer('viewport', { serialize: () => ({ zoom: 4 }), restore: () => {} });
            useTabSerializer('tab-1', 'monaco', { serialize: () => 'x', restore: () => {} });
            return () => h('span');
          },
        }),
      ),
    );

    const snapshot: DecisionGraphSnapshot = registry.serialize();
    expect(snapshot).toEqual({ graph: { viewport: { zoom: 4 } }, tabs: { 'tab-1': { monaco: 'x' } } });
  });
});
