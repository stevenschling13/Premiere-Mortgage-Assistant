
import { Client, EmailTemplate } from '../types';

const STORAGE_PREFIX = 'premiere_mortgage_';

export const StorageKeys = {
  CLIENTS: `${STORAGE_PREFIX}clients`,
  TEMPLATES: `${STORAGE_PREFIX}templates`,
  RATES: `${STORAGE_PREFIX}rates`,
  NOTES: `${STORAGE_PREFIX}notes`,
  RECENT_IDS: `${STORAGE_PREFIX}recent_ids`,
  CHAT_HISTORY: `${STORAGE_PREFIX}chat_history`,
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
