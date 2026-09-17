import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserType } from '@prisma/client';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { EmailLogService } from './email-log.service';
import { NewsletterService } from './newsletter.service';
import { SesMailService } from './ses-mail.service';

@Controller('admin/mail')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminMailController {
  constructor(
    private readonly mail: SesMailService,
    private readonly newsletter: NewsletterService,
    private readonly emailLogs: EmailLogService,
  ) {}

  /** Admin-triggered marketing / broadcast send via SES (not a full ESP). */
  @Post('marketing')
  @Permissions('content.update')
  async sendMarketing(@Body() body: unknown) {
    return this.newsletter.sendMarketing(body);
  }

  @Get('logs')
  @Permissions('content.read')
  listLogs(@Query() query: unknown) {
    return this.emailLogs.listAdmin(query);
  }

  @Get('newsletter')
  @Permissions('content.read')
  listNewsletter(@Query() query: unknown) {
    return this.newsletter.listAdmin(query);
  }

  @Get('newsletter/count')
  @Permissions('content.read')
  async newsletterCount(@Query('locale') locale?: string) {
    const allowed = ['en', 'ar', 'fr'] as const;
    const loc =
      locale && allowed.includes(locale as (typeof allowed)[number])
        ? (locale as 'en' | 'ar' | 'fr')
        : null;
    if (locale && locale !== 'all' && !loc) {
      throw new BadRequestException('Invalid locale');
    }
    const total = await this.newsletter.countActive(loc);
    return {
      total,
      sesConfigured: this.mail.isConfigured(),
    };
  }
}
