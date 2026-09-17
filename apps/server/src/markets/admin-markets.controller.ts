import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { MarketsService } from './markets.service';

@Controller('admin/markets')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminMarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get()
  @Permissions('orders.read')
  list() {
    return this.marketsService.list();
  }

  @Patch(':code')
  @Permissions('orders.update')
  update(@Param('code') code: string, @Body() body: unknown) {
    return this.marketsService.update(code, body);
  }
}
