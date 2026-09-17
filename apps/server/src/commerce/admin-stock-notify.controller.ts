import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { StockNotifyService } from './stock-notify.service';

@Controller('admin/stock-notify')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminStockNotifyController {
  constructor(private readonly stockNotifyService: StockNotifyService) {}

  @Get()
  @Permissions('inventory.read')
  list(@Query() query: unknown) {
    return this.stockNotifyService.listAdmin(query);
  }

  @Patch(':id/notified')
  @Permissions('inventory.update')
  markNotified(@Param('id') id: string) {
    return this.stockNotifyService.markNotified(id);
  }
}
