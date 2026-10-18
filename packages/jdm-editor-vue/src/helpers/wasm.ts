import initWasm, { isReady } from '@gorules/zen-engine-wasm';
import { readonly, ref, type Ref } from 'vue';

let wasmAvailable = false;
let wasmInitPromise: Promise<void> | null = null;

// Single shared reactive source; Vue reactivity fans out to every consumer,
// replacing upstream's manual wasmListeners Set.
const wasmReady = ref(false);

export const isWasmAvailable = (): boolean => {
  if (wasmAvailable) {
    return true;
  }

  try {
    if (isReady()) {
      wasmAvailable = true;
      wasmReady.value = true;
      return wasmAvailable;
    }
  } catch {
    return false;
  }

  return false;
};

export const ensureWasmLoaded = (): Promise<void> => {
  if (isWasmAvailable()) {
    return Promise.resolve();
  }

  if (!wasmInitPromise) {
    wasmInitPromise = initWasm()
      .then(() => {
        wasmAvailable = true;
        wasmReady.value = true;
      })
      .catch(() => {
        wasmInitPromise = null;
      });
  }

  return wasmInitPromise;
};

export const useWasmReady = (): Readonly<Ref<boolean>> => {
  if (!wasmReady.value) {
    void ensureWasmLoaded();
  }

  return readonly(wasmReady);
};
