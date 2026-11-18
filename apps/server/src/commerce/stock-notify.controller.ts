import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { RequestUser } from '../auth/auth.types';
import { StockNotifyService } from './stock-notify.service';

@Controller('stock-notify')
export class StockNotifyController {
  constructor(private readonly stockNotifyService: StockNotifyService) {}

  @Get('status')
  @UseGuards(OptionalJwtAuthGuard)
  status(@Query('productId') productId: string, @Query('variantId') variantId: string, @CurrentUser() user?: RequestUser | null) {
    return this.stockNotifyService.getCustomerSubscriptionStatus({ productId, variantId }, user?.sub);
  }

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  subscribe(@Body() body: unknown, @CurrentUser() user?: RequestUser | null) {
    return this.stockNotifyService.subscribe(body, {
      userId: user?.sub,
      userEmail: user?.email,
    });
  }

  @Post('verify')
  verify(@Body('token') token = '') {
    return this.stockNotifyService.verifyGuest(String(token));
  }
}
