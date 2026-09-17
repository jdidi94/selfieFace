import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { normalizeApiErrorPayload } from '../http/normalize-api-error';

type ErrorBody = {
  statusCode: number;
  message: string;
  fieldErrors?: Record<string, string[]>;
  error: string;
  path: string;
  timestamp: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProd = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorName = 'Internal Server Error';
    let normalized = normalizeApiErrorPayload('An unexpected error occurred');

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      errorName = HttpStatus[status] ?? exception.name;
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        normalized = normalizeApiErrorPayload(payload);
      } else if (payload && typeof payload === 'object') {
        const obj = payload as Record<string, unknown>;
        if ('formErrors' in obj || 'fieldErrors' in obj) {
          normalized = normalizeApiErrorPayload(obj as Record<string, unknown>);
        } else if (obj.message != null) {
          normalized = normalizeApiErrorPayload(
            obj.message as string | string[] | Record<string, unknown>,
          );
        } else {
          normalized = normalizeApiErrorPayload(undefined);
        }
        if (typeof obj.error === 'string') {
          errorName = obj.error;
        }
      }
    } else if (exception instanceof Error) {
      normalized = normalizeApiErrorPayload(
        isProd ? 'An unexpected error occurred' : exception.message,
      );
    }

    const body: ErrorBody = {
      statusCode: status,
      message: normalized.message,
      ...(normalized.fieldErrors ? { fieldErrors: normalized.fieldErrors } : {}),
      error: errorName,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} → ${status}: ${JSON.stringify(normalized.message)}`,
      );
    }

    response.status(status).json(body);
  }
}
