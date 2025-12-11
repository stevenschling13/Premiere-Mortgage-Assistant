import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { __resetStorageStateForTests, flushPendingWrites, loadFromStorage, saveToStorage, StorageKeys } from './storageService';

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
    vi.useRealTimers();
    __resetStorageStateForTests();
    // Ensure a clean slate for localStorage detection
    // @ts-expect-error - we intentionally clear the global for non-browser simulation
    delete globalThis.localStorage;
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('debounces writes and persists the latest payload', () => {
    vi.useFakeTimers();
    const storage = createStubStorage();
    globalThis.localStorage = storage;

    saveToStorage(StorageKeys.NOTES, { value: 'first' });
    saveToStorage(StorageKeys.NOTES, { value: 'second' });

    expect(storage.getItem(StorageKeys.NOTES)).toBeNull();

    vi.advanceTimersByTime(300);

    const persisted = storage.getItem(StorageKeys.NOTES);
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted as string)).toEqual({ value: 'second' });
  });

  it('flushes pending writes immediately when requested', () => {
    vi.useFakeTimers();
    const storage = createStubStorage();
    globalThis.localStorage = storage;

    saveToStorage(StorageKeys.MANUAL_DEALS, { id: 'deal-1' });

    expect(storage.getItem(StorageKeys.MANUAL_DEALS)).toBeNull();

    flushPendingWrites();

    const persisted = storage.getItem(StorageKeys.MANUAL_DEALS);
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted as string)).toEqual({ id: 'deal-1' });

    // Calling flush again should be a no-op and not throw due to stale timers
    expect(() => flushPendingWrites()).not.toThrow();
  });
});

