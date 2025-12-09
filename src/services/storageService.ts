import { bulkWriteRecords, openDatabase, resetDatabase, writeRecord, readAllRecords } from './db';

const STORAGE_PREFIX = 'premiere_mortgage_';

export const StorageKeys = {
  CLIENTS: `${STORAGE_PREFIX}clients`,
  TEMPLATES: `${STORAGE_PREFIX}templates`,
  RATES: `${STORAGE_PREFIX}rates`,
  NOTES: `${STORAGE_PREFIX}notes`,
  RECENT_IDS: `${STORAGE_PREFIX}recent_ids`,
  CHAT_HISTORY: `${STORAGE_PREFIX}chat_history`,
  DEAL_STAGES: `${STORAGE_PREFIX}deal_stages`,
  USER_PROFILE: `${STORAGE_PREFIX}user_profile`,
  MARKETING_DATA: `${STORAGE_PREFIX}marketing_data`,
  CALCULATOR_SCENARIO: `${STORAGE_PREFIX}calculator_scenario`,
  DTI_DATA: `${STORAGE_PREFIX}dti_data`,
  COMP_SETTINGS: `${STORAGE_PREFIX}comp_settings`,
  MANUAL_DEALS: `${STORAGE_PREFIX}manual_deals`,
  SAVED_VIEWS: `${STORAGE_PREFIX}saved_views`,
  MARKET_DATA: `${STORAGE_PREFIX}market_data`,
  VALUATIONS: `${STORAGE_PREFIX}valuations`,
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

export interface StorageBootstrapStatus {
  recovered: boolean;
  warnings: string[];
}

// In-memory caches to prevent redundant disk I/O
const writeCache = new Map<string, string>();
const memoryCache = new Map<string, any>();

// Debounce State
const pendingWrites = new Map<string, any>();
const writeTimers = new Map<string, any>();
const DEBOUNCE_DELAY = 300; // ms

let bootstrapPromise: Promise<StorageBootstrapStatus> | null = null;
let bootstrapStatus: StorageBootstrapStatus = { recovered: false, warnings: [] };

// Helper: Recursively clean data to try and fit into storage (e.g. remove large Base64 images)
const sanitizeForStorage = (data: any, depth = 0): any => {
  if (depth > 5) return data; // Increased depth limit to reach nested Client email logs

  if (typeof data === 'string') {
    // Truncate Base64 images or massive strings (likely image data URIs)
    if (data.startsWith('data:image') && data.length > 500) {
      return '[Image removed to save space]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeForStorage(item, depth + 1));
  }

  if (typeof data === 'object' && data !== null) {
    const newData: any = {};
    for (const key in data) {
      newData[key] = sanitizeForStorage(data[key], depth + 1);
    }
    return newData;
  }
  return data;
};

const cloneValue = <T>(value: T): T => {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
};

const isQuotaError = (error: any) => error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED';

const markRecovery = (message: string) => {
  if (!bootstrapStatus.warnings.includes(message)) {
    bootstrapStatus = {
      ...bootstrapStatus,
      recovered: true,
      warnings: [...bootstrapStatus.warnings, message],
    };
  } else {
    bootstrapStatus = { ...bootstrapStatus, recovered: true };
  }
};

const hydrateFromDexie = async () => {
  await openDatabase();
  const records = await readAllRecords();

  for (const record of records) {
    try {
      const parsed = JSON.parse(record.value);
      memoryCache.set(record.key, parsed);
      writeCache.set(record.key, record.value);
    } catch (error) {
      throw new Error(`Failed to parse stored value for ${record.key}: ${String(error)}`);
    }
  }
};

const migrateLegacyLocalStorage = async () => {
  if (typeof localStorage === 'undefined') return;

  const keys = Object.values(StorageKeys);
  const migratedRecords: { key: string; value: string; updatedAt: number }[] = [];

  for (const key of keys) {
    let raw: string | null = null;

    try {
      raw = localStorage.getItem(key);
    } catch (error) {
      markRecovery(`Saved data for ${key} could not be read. Resetting to defaults.`);
      continue;
    }

    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const serialized = JSON.stringify(parsed);

      memoryCache.set(key, parsed);
      writeCache.set(key, serialized);
      migratedRecords.push({ key, value: serialized, updatedAt: Date.now() });
    } catch (error) {
      markRecovery(`Detected corrupted data for ${key}. Starting fresh.`);
    } finally {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }

  if (migratedRecords.length > 0) {
    await bulkWriteRecords(migratedRecords);
  }
};

const initializeDexie = async (): Promise<StorageBootstrapStatus> => {
  try {
    await hydrateFromDexie();
  } catch (error) {
    console.warn('Dexie hydration failed. Resetting IndexedDB.', error);
    memoryCache.clear();
    writeCache.clear();
    pendingWrites.clear();
    markRecovery('We reset saved workspace data after detecting a storage problem. Recent offline changes may be missing.');
    await resetDatabase();

    try {
      await hydrateFromDexie();
    } catch (secondaryError) {
      markRecovery('IndexedDB was unavailable. Using fresh in-memory defaults.');
      console.error('Second attempt to hydrate Dexie failed', secondaryError);
      return bootstrapStatus;
    }
  }

  await migrateLegacyLocalStorage();
  return bootstrapStatus;
};

export const initializeStorage = async (): Promise<StorageBootstrapStatus> => {
  if (!bootstrapPromise) {
    bootstrapPromise = initializeDexie();
  }
  return bootstrapPromise;
};

const performWrite = async (key: StorageKey, data: any, attempt = 0) => {
  const sanitized = sanitizeForStorage(data);
  const serialized = JSON.stringify(sanitized);

  // Performance: Skip write if data hasn't changed since last save
  if (writeCache.get(key) === serialized) {
    pendingWrites.delete(key);
    if (writeTimers.has(key)) {
      clearTimeout(writeTimers.get(key));
      writeTimers.delete(key);
    }
    return;
  }

  try {
    await openDatabase();
    await writeRecord(key, serialized);
    memoryCache.set(key, sanitized);
    writeCache.set(key, serialized);

    pendingWrites.delete(key);
    if (writeTimers.has(key)) {
      clearTimeout(writeTimers.get(key));
      writeTimers.delete(key);
    }
  } catch (error: any) {
    if (isQuotaError(error) && attempt === 0) {
      console.warn('IndexedDB quota issue detected. Attempting recovery.', error);
      markRecovery('Local data exceeded available storage and was reset.');
      await resetDatabase();
      memoryCache.clear();
      writeCache.clear();
      pendingWrites.clear();
      return performWrite(key, sanitized, attempt + 1);
    }
    console.error('Error saving to storage', error);
  }
};

export const saveToStorage = (key: StorageKey, data: any, immediate = false) => {
  // 1. Update pending map immediately so UI reads are consistent
  pendingWrites.set(key, data);

  // 2. Clear existing timer for this key
  if (writeTimers.has(key)) {
    clearTimeout(writeTimers.get(key));
  }

  const writer = async () => {
    try {
      await initializeStorage();
      await performWrite(key, data);
    } catch (error) {
      console.error('Failed to persist data', error);
    }
  };

  if (immediate) {
    void writer();
  } else {
    // 3. Schedule write
    const timer = setTimeout(() => {
      void writer();
    }, DEBOUNCE_DELAY);
    writeTimers.set(key, timer);
  }
};

export const loadFromStorage = <T>(key: StorageKey, fallback: T): T => {
  // 1. Check dirty memory state first (pending writes)
  if (pendingWrites.has(key)) {
    return pendingWrites.get(key) as T;
  }

  if (!bootstrapPromise) {
    void initializeStorage();
  }

  if (memoryCache.has(key)) {
    return cloneValue(memoryCache.get(key));
  }

  return fallback;
};

export const getStorageBootstrapStatus = () => bootstrapStatus;

// Safety Flush on Page Unload to prevent data loss
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    pendingWrites.forEach((data, key) => {
      void performWrite(key as StorageKey, data, 0);
    });
  });
}