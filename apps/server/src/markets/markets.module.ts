import { Module } from '@nestjs/common';
import { CacheModule } from '../common/cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminMarketsController } from './admin-markets.controller';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [MarketsController, AdminMarketsController],
  providers: [MarketsService],
  exports: [MarketsService],
})
export class MarketsModule {}
