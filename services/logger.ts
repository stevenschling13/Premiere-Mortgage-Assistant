
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
}

class LoggerService {
  private isDev = process.env.NODE_ENV !== 'production';

  private log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    // In a real production app, you would send 'entry' to Sentry, Datadog, or LogRocket here.
    
    if (this.isDev || level === 'error') {
      const styles = {
        info: 'color: #0ea5e9',
        warn: 'color: #f59e0b',
        error: 'color: #ef4444',
        debug: 'color: #64748b',
      };

      console.groupCollapsed(`%c[${level.toUpperCase()}] ${message}`, styles[level]);
      console.log('Timestamp:', entry.timestamp);
      if (data) console.log('Data:', data);
      console.groupEnd();
    }
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, error?: any) {
    this.log('error', message, error);
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }
}

export const Logger = new LoggerService();
