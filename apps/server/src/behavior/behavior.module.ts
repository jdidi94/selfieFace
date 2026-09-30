import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MarketsModule } from '../markets/markets.module';
import { AdminBehaviorController } from './admin-behavior.controller';
import { BehaviorController } from './behavior.controller';
import { BehaviorService } from './behavior.service';

@Module({
  imports: [AuthModule, MarketsModule],
  controllers: [BehaviorController, AdminBehaviorController],
  providers: [BehaviorService],
  exports: [BehaviorService],
})
export class BehaviorModule {}
