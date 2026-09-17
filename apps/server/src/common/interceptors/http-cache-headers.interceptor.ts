import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export const HTTP_CACHE_KEY = 'http_cache_seconds';

/** Set public Cache-Control on successful GET responses. */
export const HttpCache = (maxAgeSeconds: number) => SetMetadata(HTTP_CACHE_KEY, maxAgeSeconds);

@Injectable()
export class HttpCacheHeadersInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const maxAge = this.reflector.getAllAndOverride<number | undefined>(HTTP_CACHE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      tap(() => {
        if (maxAge == null || maxAge < 0) return;
        const res = context.switchToHttp().getResponse<Response>();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          res.setHeader(
            'Cache-Control',
            `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
          );
        }
      }),
    );
  }
}
