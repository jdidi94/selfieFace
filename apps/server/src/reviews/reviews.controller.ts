import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import type { RequestUser } from '../auth/auth.types';
import { ReviewsService } from './reviews.service';

@Controller('products/:slug/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  list(@Param('slug') slug: string, @Query() query: unknown) {
    return this.reviewsService.listForProduct(slug, query);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, UserTypesGuard)
  @UserTypes(UserType.CUSTOMER)
  mine(@Param('slug') slug: string, @CurrentUser() user: RequestUser) {
    return this.reviewsService.getMineForProduct(user.sub, slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, UserTypesGuard)
  @UserTypes(UserType.CUSTOMER)
  upsert(
    @Param('slug') slug: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reviewsService.upsertForProduct(user.sub, slug, body);
  }
}
