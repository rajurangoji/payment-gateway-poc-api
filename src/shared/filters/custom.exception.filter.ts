import {
  ArgumentsHost,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

export class CustomExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CustomExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const request: any = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    this.logger.error(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      `Exception occurred at ${request.method} ${request.url}`,
      (exception as Error).stack,
    );

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as { message: string }).message;
      code = exception.constructor.name;
    }
    const errorResponse = {
      status: 'error',
      code,
      message,
      timestamp: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      path: request.url,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      method: request.method,
      ...(process.env.NODE_ENV === 'local' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    };

    response.status(status).send(errorResponse);
  }
}
