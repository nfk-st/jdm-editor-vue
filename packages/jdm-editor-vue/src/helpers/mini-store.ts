// Shared zustand-shaped reactive store — the machinery extracted from
// expression-store.context.ts after review (round 3 certified its semantics):
// reactive object + setState(object | updater) + getState + subscribe with a
// shallow prev snapshot that preserves nested refs for equality checks.
// dt-store and dg-store build on this.
import { reactive } from 'vue';

export type MiniStore<T extends object> = T & {
  setState: (partial: Partial<T> | ((state: T) => Partial<T> | T)) => void;
  getState: () => T;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
};

export const createMiniStore = <T extends object>(initial: () => T): MiniStore<T> => {
  const listeners = new Set<(state: T, prevState: T) => void>();
  const store = reactive({}) as MiniStore<T>;

  // zustand's set(): accepts a partial object or an updater (immer's curried
  // produce is an updater); shallow prev snapshot preserves nested refs.
  const setState = (partialOrUpdater: Partial<T> | ((state: T) => Partial<T> | T)) => {
    const prev: T = { ...store } as T;
    const partial =
      typeof partialOrUpdater === 'function'
        ? (partialOrUpdater as (state: T) => Partial<T> | T)(store)
        : partialOrUpdater;
    Object.assign(store, partial);
    listeners.forEach((listener) => listener(store, prev));
  };

  Object.assign(store, initial());
  Object.assign(store, {
    setState,
    getState: (): T => store,
    subscribe: (listener: (state: T, prevState: T) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  return store;
};
