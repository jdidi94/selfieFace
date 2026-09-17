import { Module } from '@nestjs/common';
import { MarketsModule } from '../markets/markets.module';
import { BehaviorController } from './behavior.controller';
import { BehaviorService } from './behavior.service';

@Module({
  imports: [MarketsModule],
  controllers: [BehaviorController],
  providers: [BehaviorService],
})
export class BehaviorModule {}
