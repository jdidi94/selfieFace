import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { MarketCode } from '@lumea/types';
import { ADMIN_MARKET_HEADER, parseMarketCode } from './market.util';

/**
 * Resolves admin market window from `x-market` header (or query `market`).
 * Defaults to OTHER.
 */
export const AdminMarketCode = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MarketCode => {
    const req = ctx.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      query?: Record<string, string | undefined>;
    }>();
    const headerRaw = req.headers?.[ADMIN_MARKET_HEADER] ?? req.headers?.['X-Market'];
    const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    return parseMarketCode(header ?? req.query?.market);
  },
);
