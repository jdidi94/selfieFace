import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import type { RequestUser } from '../auth/auth.types';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, UserTypesGuard)
  @UserTypes(UserType.CUSTOMER)
  me(@CurrentUser() user: RequestUser) {
    return this.customersService.getProfile(user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, UserTypesGuard)
  @UserTypes(UserType.CUSTOMER)
  updateMe(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.customersService.updateProfile(user.sub, body);
  }
}
