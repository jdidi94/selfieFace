import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { HealthStatus } from '@lumea/types';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async getHealth(): Promise<HealthStatus> {
    return this.healthService.check();
  }

  /** Liveness — process is up (for orchestrators). */
  @Get('live')
  @Header('Cache-Control', 'no-store')
  live() {
    return { status: 'ok' as const, timestamp: new Date().toISOString() };
  }

  /** Readiness — database reachable. */
  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready(@Res({ passthrough: true }) res: Response) {
    const health = await this.healthService.check();
    if (health.database !== 'up') {
      res.status(503);
    }
    return health;
  }
}
