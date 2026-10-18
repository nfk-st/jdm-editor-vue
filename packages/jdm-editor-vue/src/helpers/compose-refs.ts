import type { Ref } from 'vue';

// PORTING: React refs → Vue template refs — `.current` becomes `.value`.
// A "ref" here is either a Vue `Ref` object or a function ref `(el) => void`,
// matching what Vue's `:ref` binding accepts.
// The method-style signature below mirrors React's `RefCallback` bivariance
// hack so the WeakMap cache stays variance-valid under `strictFunctionTypes`.
type FunctionRef<T> = { bivarianceHack(instance: T | null): void }['bivarianceHack'];
type ObjectRef<T> = Ref<T | null>;

type TemplateRef<T> = FunctionRef<T> | ObjectRef<T>;
type OptionalRef<T> = TemplateRef<T> | undefined;

export function composeRefs<T>(
  ...refs: [OptionalRef<T>, OptionalRef<T>, ...Array<OptionalRef<T>>]
): TemplateRef<T> | null {
  if (refs.length === 2) {
    // micro-optimize the hot path
    return composeTwoRefs(refs[0], refs[1]) || null;
  }

  const composedRef = refs
    .slice(1)
    .reduce(
      (semiCombinedRef: OptionalRef<T>, refToInclude: OptionalRef<T>) => composeTwoRefs(semiCombinedRef, refToInclude),
      refs[0],
    );
  return composedRef || null;
}

type NonNullRef<T> = NonNullable<TemplateRef<T>>;
const composedRefCache = new WeakMap<NonNullRef<unknown>, WeakMap<NonNullRef<unknown>, NonNullRef<unknown>>>();

function composeTwoRefs<T>(ref1: OptionalRef<T>, ref2: OptionalRef<T>): OptionalRef<T> {
  if (ref1 && ref2) {
    const ref1Cache = composedRefCache.get(ref1) || new WeakMap<NonNullRef<unknown>, NonNullRef<unknown>>();
    composedRefCache.set(ref1, ref1Cache);

    const composedRef =
      ref1Cache.get(ref2) ||
      ((instance: T | null): void => {
        updateRef(ref1, instance);
        updateRef(ref2, instance);
      });
    ref1Cache.set(ref2, composedRef);

    return composedRef as NonNullRef<T>;
  }

  if (!ref1) {
    return ref2;
  } else {
    return ref1;
  }
}

function updateRef<T>(ref: NonNullRef<T>, instance: null | T): void {
  if (typeof ref === 'function') {
    ref(instance);
  } else {
    ref.value = instance;
  }
}
