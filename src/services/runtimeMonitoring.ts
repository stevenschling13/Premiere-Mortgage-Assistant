import { errorService } from './errorService';

let handlersInstalled = false;

interface MonitoringOptions {
  appVersion?: string;
  tags?: string[];
}

export const installGlobalErrorHandlers = (options?: MonitoringOptions) => {
  if (handlersInstalled || typeof window === 'undefined') return;
  handlersInstalled = true;

  errorService.setContext({
    appVersion: options?.appVersion,
    tags: options?.tags,
  });

  const handleError = (event: ErrorEvent) => {
    errorService.addBreadcrumb('window.error', {
      componentStack: event.filename,
    });
    errorService.log(
      'ERROR',
      event.message,
      { col: event.colno, line: event.lineno },
      event.error instanceof Error ? event.error : undefined,
      {
        severity: 'error',
        context: {
          componentStack: event.error?.stack,
        },
      }
    );
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const asError = reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'Unhandled rejection');
    errorService.addBreadcrumb('promise.rejection', { componentStack: asError.stack });
    errorService.log('ERROR', asError.message, { reason }, asError, { severity: 'error' });
  };

  const handleOffline = () => {
    errorService.log('DIAGNOSTIC', 'Browser went offline', undefined, undefined, {
      severity: 'warning',
      context: { tags: ['connectivity'] },
    });
  };

  const handleOnline = () => {
    errorService.log('DIAGNOSTIC', 'Browser reconnected', undefined, undefined, {
      severity: 'info',
      context: { tags: ['connectivity'] },
    });
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);
};
