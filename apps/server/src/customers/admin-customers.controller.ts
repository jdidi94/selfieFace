import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { CustomersService } from './customers.service';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminCustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Permissions('customers.read')
  list(@Query() query: unknown) {
    return this.customersService.listAdmin(query);
  }

  @Get(':id')
  @Permissions('customers.read')
  get(@Param('id') id: string) {
    return this.customersService.getAdmin(id);
  }

  @Post(':id/block')
  @Permissions('customers.update')
  block(@Param('id') id: string) {
    return this.customersService.blockCustomer(id);
  }

  @Post(':id/unblock')
  @Permissions('customers.update')
  unblock(@Param('id') id: string) {
    return this.customersService.unblockCustomer(id);
  }
}
