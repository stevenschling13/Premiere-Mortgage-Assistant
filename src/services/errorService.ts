
import { ErrorBreadcrumb, ErrorContext, ErrorLog, ErrorSeverity } from '../types';

const MAX_LOGS = 50;
const STORAGE_KEY = 'premiere_debug_logs';

class ErrorService {
  private logs: ErrorLog[] = [];
  private breadcrumbs: ErrorBreadcrumb[] = [];
  private context: Partial<ErrorContext> = {
    sessionId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
  };

  constructor() {
    this.loadLogs();
  }

  private loadLogs() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ErrorLog>[];
        this.logs = parsed.map((entry) => ({
          ...entry,
          severity: entry.severity || 'error',
        })) as ErrorLog[];
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

  public setContext(context: Partial<ErrorContext>) {
    this.context = { ...this.context, ...context };
  }

  public addBreadcrumb(message: string, context?: Partial<ErrorContext>) {
    const entry: ErrorBreadcrumb = {
      message,
      timestamp: Date.now(),
      context,
    };

    this.breadcrumbs.push(entry);
    if (this.breadcrumbs.length > MAX_LOGS) {
      this.breadcrumbs.shift();
    }
  }

  public log(
    type: ErrorLog['type'],
    message: string,
    metadata?: any,
    error?: Error,
    options?: { severity?: ErrorSeverity; context?: Partial<ErrorContext> }
  ) {
    const entry: ErrorLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now(),
      type,
      message,
      stack: error?.stack,
      metadata,
      severity: options?.severity || (type === 'USER_ACTION' ? 'info' : 'error'),
      context: { ...this.context, ...options?.context },
      breadcrumbs: [...this.breadcrumbs],
    };

    // Console mirror for development
    if (entry.severity === 'error') {
        console.error(`[${type}] ${message}`, metadata, error, entry.context);
    } else if (entry.severity === 'warning') {
        console.warn(`[${type}] ${message}`, metadata, entry.context);
    } else {
        console.log(`[${type}] ${message}`, metadata, entry.context);
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

  public getDiagnostics() {
    return {
      context: this.context,
      breadcrumbs: [...this.breadcrumbs],
      logs: this.getLogs(),
    };
  }

  public captureException(error: unknown, context?: Partial<ErrorContext>) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.log('ERROR', normalized.message, undefined, normalized, { severity: 'error', context });
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
