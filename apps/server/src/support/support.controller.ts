import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserType } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import type { RequestUser } from '../auth/auth.types';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { MediaService } from '../media/media.service';
import { SupportTicketsService } from './support-tickets.service';

@Controller('support')
@UseGuards(RateLimitGuard)
export class SupportController {
  constructor(
    private readonly ticketsService: SupportTicketsService,
    private readonly mediaService: MediaService,
  ) {}

  @Post('tickets')
  @RateLimit({ max: 10, windowMs: 60_000, keyPrefix: 'support:tickets' })
  create(@Body() body: unknown) {
    return this.ticketsService.createPublic(body);
  }

  @Post('tickets/lookup')
  @RateLimit({ max: 20, windowMs: 60_000, keyPrefix: 'support:lookup' })
  lookup(@Body() body: unknown) {
    return this.ticketsService.lookupPublic(body);
  }

  @Get('tickets/me')
  @UseGuards(JwtAuthGuard, UserTypesGuard)
  @UserTypes(UserType.CUSTOMER)
  @RateLimit({ max: 60, windowMs: 60_000, keyPrefix: 'support:me' })
  listMine(@CurrentUser() user: RequestUser) {
    return this.ticketsService.listMyTickets(user.sub);
  }

  @Post('media')
  @RateLimit({ max: 20, windowMs: 60_000, keyPrefix: 'support:media' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.mediaService.saveCustomerUpload(file);
  }
}
