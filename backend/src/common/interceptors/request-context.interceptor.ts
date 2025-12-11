import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'] ?? randomUUID();
    request.requestId = requestId;
    return next.handle().pipe(
      tap((data) => {
        const response = context.switchToHttp().getResponse();
        response.setHeader('x-request-id', requestId);
        if (data && typeof data === 'object') {
          Object.assign(data, { requestId });
        }
      }),
    );
  }
}
