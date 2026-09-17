import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export type RateLimitOptions = {
  /** Max requests in the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Optional bucket key prefix (defaults to request path). */
  keyPrefix?: string;
};

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
