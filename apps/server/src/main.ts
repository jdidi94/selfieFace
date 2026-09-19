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

  // #region agent log
  {
    const dbUrl = process.env.DATABASE_URL ?? '';
    let host = '';
    try {
      host = new URL(dbUrl.replace(/^postgresql:/, 'http:')).hostname;
    } catch {
      host = 'unparseable';
    }
    const payload = {
      sessionId: '49c334',
      runId: process.env.RENDER ? 'render' : 'local',
      hypothesisId: 'A,B,E',
      location: 'main.ts:bootstrap',
      message: 'API bootstrap env check',
      data: {
        nodeEnv: process.env.NODE_ENV ?? null,
        hasDatabaseUrl: Boolean(dbUrl),
        dbHostKind: host.includes('render.com')
          ? 'render-external'
          : host.includes('dpg-')
            ? 'render-internal-or-other'
            : host || 'empty',
        hasSslMode: /sslmode=/i.test(dbUrl),
        port: process.env.PORT ?? '4000',
        cwd: process.cwd(),
        distDir: __dirname,
      },
      timestamp: Date.now(),
    };
    // eslint-disable-next-line no-console
    console.log('[debug-49c334]', JSON.stringify(payload));
    fetch('http://127.0.0.1:7686/ingest/a3d00278-6bf0-4e32-b6e1-9df6c97cf951', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '49c334',
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
  // #endregion

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
