import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { __resetStorageStateForTests, loadFromStorage, saveToStorage, StorageKeys } from './storageService';

const createStubStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
};

describe('storageService', () => {
  beforeEach(() => {
    __resetStorageStateForTests();
    // Ensure a clean slate for localStorage detection
    // @ts-expect-error - we intentionally clear the global for non-browser simulation
    delete globalThis.localStorage;
  });

  afterEach(() => {
    __resetStorageStateForTests();
    // @ts-expect-error - cleanup test shims
    delete globalThis.localStorage;
  });

  it('falls back to in-memory storage when localStorage is unavailable', () => {
    const payload = { id: '123', name: 'Test Client' };

    saveToStorage(StorageKeys.CLIENTS, payload, true);
    expect(loadFromStorage(StorageKeys.CLIENTS, [])).toEqual(payload);
  });

  it('uses provided localStorage when available', () => {
    globalThis.localStorage = createStubStorage();

    const payload = { foo: 'bar' };
    saveToStorage(StorageKeys.RATES, payload, true);

    expect(loadFromStorage(StorageKeys.RATES, {})).toEqual(payload);
  });
});
