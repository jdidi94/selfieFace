import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Currency, UserType } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import type { RequestUser } from '../auth/auth.types';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
@UseGuards(JwtAuthGuard, UserTypesGuard)
@UserTypes(UserType.CUSTOMER)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('currency') currency?: string) {
    return this.wishlistService.list(user.sub, (currency as Currency) || Currency.USD);
  }

  @Get('ids')
  ids(@CurrentUser() user: RequestUser) {
    return this.wishlistService.productIds(user.sub);
  }

  @Post()
  add(
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
    @Query('currency') currency?: string,
  ) {
    return this.wishlistService.add(user.sub, body, (currency as Currency) || Currency.USD);
  }

  @Delete(':productId')
  async remove(@CurrentUser() user: RequestUser, @Param('productId') productId: string) {
    await this.wishlistService.remove(user.sub, productId);
    return { ok: true };
  }
}
