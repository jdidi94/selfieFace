import { Body, Controller, Delete, Get, Param, Patch, Put, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { AdminHelpService } from './admin-help.service';

@Controller('admin/help-notes')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminHelpController {
  constructor(private readonly service: AdminHelpService) {}

  @Get()
  @Permissions('content.read')
  list(@AdminMarketCode() market: MarketCode) { return this.service.list(market); }

  @Patch('settings')
  @Permissions('content.update')
  setEnabled(@AdminMarketCode() market: MarketCode, @Body() body: { enabled?: unknown }) { return this.service.setEnabled(market, body?.enabled); }

  @Put(':fieldKey')
  @Permissions('content.update')
  save(@AdminMarketCode() market: MarketCode, @Param('fieldKey') fieldKey: string, @Body() body: unknown) { return this.service.save(market, fieldKey, body); }

  @Delete(':fieldKey')
  @Permissions('content.update')
  remove(@AdminMarketCode() market: MarketCode, @Param('fieldKey') fieldKey: string) { return this.service.remove(market, fieldKey); }
}
