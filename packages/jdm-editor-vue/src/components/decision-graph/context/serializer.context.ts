// Ported from components/decision-graph/context/serializer.context.tsx.
// PORTING: React context + useRef/useMemo/useEffect → provide/inject. The
// provider runs once per setup, so the registry needs no useMemo; the ref
// Maps become closure state; useEffect register/unregister becomes
// watchEffect(onCleanup) — registration happens at setup instead of
// post-mount, which is unobservable because serialize()/restore() only run
// long after mount. The `deps` params are kept for signature parity and
// ignored: composables run once per setup and Vue reactivity supersedes
// React's dependency lists.
import { type InjectionKey, inject, provide, shallowRef, watchEffect } from 'vue';

export type Slice<T = unknown> = {
  serialize: () => T;
  restore: (state: T) => void;
};

export type TabSnapshot = Record<string, unknown>;

export type DecisionGraphSnapshot = {
  graph?: Record<string, unknown>;
  tabs?: Record<string, TabSnapshot>;
};

type Registry = {
  registerGraph: (key: string, slice: Slice) => () => void;
  registerTab: (tabId: string, key: string, slice: Slice) => () => void;
  serialize: () => DecisionGraphSnapshot;
  restore: (snapshot: DecisionGraphSnapshot) => void;
};

const SerializerKey: InjectionKey<Registry | null> = Symbol('serializer-registry');

const createSerializerRegistry = (): Registry => {
  const graphSlices = new Map<string, Slice>();
  const tabSlices = new Map<string, Map<string, Slice>>();
  const pendingGraph = new Map<string, unknown>();
  const pendingTabs = new Map<string, Map<string, unknown>>();

  const tryRestore = (slice: Slice, value: unknown, label: string) => {
    try {
      slice.restore(value);
    } catch (err) {
      console.warn(`Failed to restore "${label}"`, err);
    }
  };

  return {
    registerGraph: (key, slice) => {
      graphSlices.set(key, slice);
      if (pendingGraph.has(key)) {
        const pending = pendingGraph.get(key);
        pendingGraph.delete(key);
        tryRestore(slice, pending, `graph.${key}`);
      }
      return () => {
        if (graphSlices.get(key) === slice) graphSlices.delete(key);
      };
    },
    registerTab: (tabId, key, slice) => {
      if (!tabSlices.has(tabId)) tabSlices.set(tabId, new Map());
      tabSlices.get(tabId)!.set(key, slice);

      const pendingForTab = pendingTabs.get(tabId);
      if (pendingForTab?.has(key)) {
        const pending = pendingForTab.get(key);
        pendingForTab.delete(key);
        if (pendingForTab.size === 0) pendingTabs.delete(tabId);
        tryRestore(slice, pending, `tabs.${tabId}.${key}`);
      }
      return () => {
        const bag = tabSlices.get(tabId);
        if (bag?.get(key) === slice) {
          bag.delete(key);
          if (bag.size === 0) tabSlices.delete(tabId);
        }
      };
    },
    serialize: () => {
      const snapshot: DecisionGraphSnapshot = {};
      const graph: Record<string, unknown> = {};
      for (const [key, slice] of graphSlices) {
        try {
          const value = slice.serialize();
          if (value !== undefined) graph[key] = value;
        } catch (err) {
          console.warn(`Failed to serialize graph.${key}`, err);
        }
      }
      if (Object.keys(graph).length > 0) snapshot.graph = graph;

      const tabs: Record<string, TabSnapshot> = {};
      for (const [tabId, bag] of tabSlices) {
        const tabBag: TabSnapshot = {};
        for (const [key, slice] of bag) {
          try {
            const value = slice.serialize();
            if (value !== undefined) tabBag[key] = value;
          } catch (err) {
            console.warn(`Failed to serialize tabs.${tabId}.${key}`, err);
          }
        }
        if (Object.keys(tabBag).length > 0) tabs[tabId] = tabBag;
      }
      if (Object.keys(tabs).length > 0) snapshot.tabs = tabs;

      return snapshot;
    },
    restore: (snapshot) => {
      pendingGraph.clear();
      pendingTabs.clear();

      for (const [key, value] of Object.entries(snapshot?.graph ?? {})) {
        const slice = graphSlices.get(key);
        if (slice) tryRestore(slice, value, `graph.${key}`);
        else pendingGraph.set(key, value);
      }

      for (const [tabId, bag] of Object.entries(snapshot?.tabs ?? {})) {
        for (const [key, value] of Object.entries(bag ?? {})) {
          const slice = tabSlices.get(tabId)?.get(key);
          if (slice) {
            tryRestore(slice, value, `tabs.${tabId}.${key}`);
          } else {
            if (!pendingTabs.has(tabId)) pendingTabs.set(tabId, new Map());
            pendingTabs.get(tabId)!.set(key, value);
          }
        }
      }
    },
  };
};

export const SerializerProvider = (): Registry => {
  const registry = createSerializerRegistry();
  provide(SerializerKey, registry);
  return registry;
};

// Upstream returns null when no provider is mounted — kept literal.
export const useSerializerRegistry = (): Registry | null => inject(SerializerKey, null);

function useSlice<T>(
  registerFn: ((slice: Slice) => () => void) | null,
  slice: Slice<T>,
  // PORTING: upstream's React.DependencyList; unused (see file header).
  _deps?: unknown[],
): void {
  // PORTING: upstream keeps the latest slice in a ref so a registration made
  // by an earlier effect serializes with the current closure; shallowRef
  // plays that role here.
  const sliceRef = shallowRef(slice);

  watchEffect((onCleanup) => {
    if (!registerFn) return;
    onCleanup(
      registerFn({
        serialize: () => sliceRef.value.serialize(),
        restore: (state) => sliceRef.value.restore(state as T),
      }),
    );
  });
}

export function useGraphSerializer<T = unknown>(
  key: string | null | undefined,
  slice: Slice<T>,
  deps: unknown[] = [],
): void {
  const registry = useSerializerRegistry();
  const registerFn = registry && key ? (s: Slice) => registry.registerGraph(key, s) : null;
  useSlice(registerFn, slice, [registry, key, ...deps]);
}

export function useTabSerializer<T = unknown>(
  tabId: string | null | undefined,
  key: string | null | undefined,
  slice: Slice<T>,
  deps: unknown[] = [],
): void {
  const registry = useSerializerRegistry();
  const registerFn = registry && tabId && key ? (s: Slice) => registry.registerTab(tabId, key, s) : null;
  useSlice(registerFn, slice, [registry, tabId, key, ...deps]);
}
