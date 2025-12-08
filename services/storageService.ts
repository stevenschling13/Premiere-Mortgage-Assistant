

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