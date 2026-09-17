import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

// Always load apps/server/.env (nest watch runs from dist/)
loadEnv({ path: resolve(__dirname, '../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpCacheHeadersInterceptor } from './common/interceptors/http-cache-headers.interceptor';
import { Reflector } from '@nestjs/core';
import { ADMIN_MARKET_HEADER } from './markets/market.util';

function parseOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv?.length) return fromEnv;
  return [
    process.env.CLIENT_URL ?? 'http://localhost:3000',
    process.env.ADMIN_URL ?? 'http://localhost:3001',
  ];
}

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: isProd ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new HttpCacheHeadersInterceptor(app.get(Reflector)));

  const origins = parseOrigins();
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'x-guest-order-token',
      'x-cart-id',
      'x-guest-token',
      ADMIN_MARKET_HEADER,
    ],
  });

  // Trust proxy when behind Render / CDN / reverse proxy (HTTPS termination)
  if (isProd || process.env.TRUST_PROXY === '1') {
    const httpAdapter = app.getHttpAdapter();
    const instance = httpAdapter.getInstance() as { set?: (k: string, v: unknown) => void };
    instance.set?.('trust proxy', 1);
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Selfieface API listening on http://localhost:${port}/api`);
}

void bootstrap();
