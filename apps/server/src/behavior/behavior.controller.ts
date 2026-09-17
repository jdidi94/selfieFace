import { Body, Controller, Post } from '@nestjs/common';
import { BehaviorService } from './behavior.service';

@Controller('behavior')
export class BehaviorController {
  constructor(private readonly behaviorService: BehaviorService) {}

  @Post('batch')
  batch(@Body() body: unknown) {
    return this.behaviorService.ingestBatch(body);
  }
}
