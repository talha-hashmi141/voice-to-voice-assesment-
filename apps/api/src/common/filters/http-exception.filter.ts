import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiError } from '@voice-agent/contracts';
import { type Request, type Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';

/** Normalises every error into the shared ApiError contract. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const body = this.toApiError(exception, request.id);
    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    response.status(body.statusCode).json(body);
  }

  private toApiError(exception: unknown, requestId?: string): ApiError {
    if (exception instanceof ZodValidationException) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: (exception.getZodError() as { issues?: unknown }).issues,
        requestId,
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);
      return {
        statusCode: status,
        code: HttpStatus[status] ?? 'HTTP_ERROR',
        message: Array.isArray(message) ? message.join('; ') : message,
        requestId,
      };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      requestId,
    };
  }
}
