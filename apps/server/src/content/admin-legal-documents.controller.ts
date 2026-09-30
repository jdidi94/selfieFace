import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { LegalDocumentsService } from './legal-documents.service';

@Controller('admin/legal-documents')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminLegalDocumentsController {
  constructor(private readonly legalDocuments: LegalDocumentsService) {}

  @Get()
  @Permissions('content.read')
  list(@AdminMarketCode() market: MarketCode) {
    return this.legalDocuments.listAdmin(market);
  }

  @Post()
  @Permissions('content.update')
  save(@AdminMarketCode() market: MarketCode, @Body() body: unknown) {
    return this.legalDocuments.save(body, market);
  }
}
