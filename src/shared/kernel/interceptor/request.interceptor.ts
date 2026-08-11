import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class RequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // eslint-disable-next-line
    const request: any = context.switchToHttp().getRequest();
    this.logIncomingRequest(request);
    return next.handle();
  }

  /* eslint-disable */
  private logIncomingRequest(request: any): void {
    const method = request.method;
    const path = request.originalUrl ?? request.url;
    const queryString =
      Object.keys(request.query).length > 0
        ? `?${new URLSearchParams(request.query as any).toString()}`
        : '';
    const fullUrl = path + queryString;
    this.logger.log(`received request: ${method} ${fullUrl}`);
  }
}
