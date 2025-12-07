
import { Client, EmailTemplate, UserProfile, DealStage } from '../types';

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
  API_KEY: `${STORAGE_PREFIX}custom_api_key`, // New: Support for BYOK
};

export const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to storage', error);
  }
};

export const loadFromStorage = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (error) {
    console.warn(`Error loading ${key} from storage, using fallback.`);
    return fallback;
  }
};

// --- Production Features: Backup & Restore ---

export interface AppBackup {
  version: number;
  timestamp: string;
  data: {
    clients: Client[];
    userProfile: UserProfile;
    dealStages: DealStage[];
    rates: any;
    notes: string;
    chatHistory: any[];
  };
}

export const exportAllData = (): string => {
  const backup: AppBackup = {
    version: 1,
    timestamp: new Date().toISOString(),
    data: {
      clients: loadFromStorage(StorageKeys.CLIENTS, []),
      userProfile: loadFromStorage(StorageKeys.USER_PROFILE, {} as any),
      dealStages: loadFromStorage(StorageKeys.DEAL_STAGES, []),
      rates: loadFromStorage(StorageKeys.RATES, {}),
      notes: loadFromStorage(StorageKeys.NOTES, ''),
      chatHistory: loadFromStorage(StorageKeys.CHAT_HISTORY, [])
    }
  };
  return JSON.stringify(backup, null, 2);
};

export const importAllData = (jsonString: string): boolean => {
  try {
    const backup: AppBackup = JSON.parse(jsonString);
    if (!backup.data) throw new Error("Invalid backup format");

    saveToStorage(StorageKeys.CLIENTS, backup.data.clients);
    saveToStorage(StorageKeys.USER_PROFILE, backup.data.userProfile);
    saveToStorage(StorageKeys.DEAL_STAGES, backup.data.dealStages);
    saveToStorage(StorageKeys.RATES, backup.data.rates);
    saveToStorage(StorageKeys.NOTES, backup.data.notes);
    saveToStorage(StorageKeys.CHAT_HISTORY, backup.data.chatHistory);
    
    return true;
  } catch (error) {
    console.error("Import failed", error);
    return false;
  }
};

export const clearAllData = () => {
    Object.values(StorageKeys).forEach(key => {
        // Don't delete the API key on a standard reset, only business data
        if (key !== StorageKeys.API_KEY) {
            localStorage.removeItem(key);
        }
    });
};
