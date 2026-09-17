import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import type { RequestUser } from '../auth/auth.types';

@Controller('admin')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @Permissions('analytics.read')
  adminMe(@CurrentUser() user: RequestUser) {
    return this.authService.me(user.sub);
  }
}
