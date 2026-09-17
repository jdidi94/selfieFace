import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { RequestUser } from '../auth/auth.types';
import { StockNotifyService } from './stock-notify.service';

@Controller('stock-notify')
export class StockNotifyController {
  constructor(private readonly stockNotifyService: StockNotifyService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  subscribe(@Body() body: unknown, @CurrentUser() user?: RequestUser | null) {
    return this.stockNotifyService.subscribe(body, {
      userId: user?.sub,
      userEmail: user?.email,
    });
  }
}
