import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { ReviewsService } from './reviews.service';

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @Permissions('customers.read')
  list(@Query() query: unknown) {
    return this.reviewsService.listAdmin(query);
  }

  @Patch(':id/status')
  @Permissions('customers.read')
  moderate(@Param('id') id: string, @Body() body: unknown) {
    return this.reviewsService.moderateAdmin(id, body);
  }
}
