import { type Ref, shallowRef, watch } from 'vue';

const memoryCache: Record<string, unknown> = {};

// PORTING: React's `Dispatch<SetStateAction<S>>` → a plain setter that accepts
// either a value or an updater, keeping upstream's `[state, setState]` tuple shape.
type SetStateAction<S> = S | ((prevState: S) => S);

export const usePersistentState = <S>(
  key: string,
  defaultValue?: S,
): [Ref<S | undefined>, (value: SetStateAction<S | undefined>) => void] => {
  // PORTING: `useState` → `shallowRef` — state is replaced wholesale (like
  // React's setState), never mutated in place, so shallow reactivity matches.
  const state = shallowRef<S | undefined>((memoryCache?.[key] as S) ?? defaultValue);

  // React's useEffect writes the cache after mount and on every state change;
  // the immediate watch mirrors the mount write.
  watch(
    state,
    (value) => {
      memoryCache[key] = value;
    },
    { immediate: true },
  );

  const setState = (value: SetStateAction<S | undefined>): void => {
    state.value =
      typeof value === 'function' ? (value as (prevState: S | undefined) => S | undefined)(state.value) : value;
  };

  return [state, setState];
};
