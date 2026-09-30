import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { SupportTicketsService } from './support-tickets.service';

@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminSupportTicketsController {
  constructor(private readonly ticketsService: SupportTicketsService) {}

  @Get()
  @Permissions('tickets.read')
  list(@AdminMarketCode() market: MarketCode, @Query() query: unknown) {
    return this.ticketsService.listAdmin(market, query);
  }

  @Get(':id')
  @Permissions('tickets.read')
  get(@Param('id') id: string) {
    return this.ticketsService.getAdmin(id);
  }

  @Patch(':id')
  @Permissions('tickets.update')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.ticketsService.updateAdmin(id, body);
  }
}
