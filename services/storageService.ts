import { Client, EmailTemplate } from '../types';

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
  CALENDAR_EVENTS: `${STORAGE_PREFIX}calendar_events`,
};

// In-memory write cache to prevent redundant disk I/O
const writeCache = new Map<string, string>();

// Debounce State
const pendingWrites = new Map<string, any>();
const writeTimers = new Map<string, any>();
// Increased debounce to 1000ms for better performance during rapid typing
const DEBOUNCE_DELAY = 1000; 

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

const performWrite = (key: string, data: any) => {
    try {
        const serialized = JSON.stringify(data);
        
        // Performance: Skip write if data hasn't changed since last save
        if (writeCache.get(key) === serialized) {
            return;
        }

        localStorage.setItem(key, serialized);
        writeCache.set(key, serialized);
        
        // Cleanup pending state after successful write
        pendingWrites.delete(key);
        if (writeTimers.has(key)) {
            clearTimeout(writeTimers.get(key));
            writeTimers.delete(key);
        }

    } catch (error: any) {
        if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.warn('LocalStorage Quota Exceeded. Attempting to sanitize data...', key);
            try {
                // Attempt fallback: Remove heavy artifacts and retry
                const sanitized = sanitizeForStorage(data);
                const serializedSanitized = JSON.stringify(sanitized);
                
                // Check cache again for sanitized version
                if (writeCache.get(key) === serializedSanitized) return;

                localStorage.setItem(key, serializedSanitized);
                writeCache.set(key, serializedSanitized);
                
                pendingWrites.delete(key);
            } catch (retryError) {
                console.error('Failed to save even after sanitization.', retryError);
            }
        } else {
            console.error('Error saving to storage', error);
        }
    }
};

export const saveToStorage = (key: string, data: any, immediate = false) => {
    // 1. Update pending map immediately so UI reads are consistent
    pendingWrites.set(key, data);

    // 2. Clear existing timer for this key
    if (writeTimers.has(key)) {
        clearTimeout(writeTimers.get(key));
    }

    if (immediate) {
        performWrite(key, data);
    } else {
        // 3. Schedule write
        const timer = setTimeout(() => {
            performWrite(key, data);
        }, DEBOUNCE_DELAY);
        writeTimers.set(key, timer);
    }
};

export const loadFromStorage = <T>(key: string, fallback: T): T => {
  // 1. Check dirty memory state first (pending writes)
  if (pendingWrites.has(key)) {
      return pendingWrites.get(key) as T;
  }

  try {
    const item = localStorage.getItem(key);
    // Populate cache on read to ensure consistency
    if (item) {
        writeCache.set(key, item);
        try {
            return JSON.parse(item);
        } catch (parseError) {
            console.error(`Malformed JSON in storage for key: ${key}. Resetting to fallback.`, parseError);
            // Optional: Backup corrupted data for debug? localStorage.setItem(key + '_corrupt', item);
            return fallback;
        }
    }
    return fallback;
  } catch (error) {
    console.warn(`Error loading ${key} from storage, using fallback.`, error);
    return fallback;
  }
};

// Safety Flush on Page Unload to prevent data loss
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        pendingWrites.forEach((data, key) => {
            performWrite(key, data);
        });
    });
}