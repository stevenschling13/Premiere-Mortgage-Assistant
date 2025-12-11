import { ErrorLog } from '../types';

const MAX_LOGS = 50;
const STORAGE_KEY = 'premiere_debug_logs';

class ErrorService {
  private logs: ErrorLog[] = [];

  constructor() {
    this.loadLogs();
  }

  private loadLogs() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load debug logs', e);
    }
  }

  private saveLogs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      // If storage is full, we might just stop saving logs or clear old ones
      if (this.logs.length > 10) {
          this.logs = this.logs.slice(this.logs.length - 10);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs)); } catch (e2) {}
      }
    }
  }

  public log(type: ErrorLog['type'], message: string, metadata?: any, error?: Error) {
    const entry: ErrorLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now(),
      type,
      message,
      stack: error?.stack,
      metadata
    };

    // Console mirror for development
    if (type === 'ERROR' || type === 'API_FAIL') {
        console.error(`[${type}] ${message}`, metadata, error);
    } else {
        console.log(`[${type}] ${message}`, metadata);
    }

    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) {
      this.logs.shift(); // Remove oldest
    }
    this.saveLogs();
  }

  public getLogs(): ErrorLog[] {
    return [...this.logs].sort((a, b) => b.timestamp - a.timestamp);
  }

  public clearLogs() {
    this.logs = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  public exportLogs() {
    const dataStr = JSON.stringify(this.logs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug_logs_${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const errorService = new ErrorService();