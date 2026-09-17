import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  Locale,
  NewsletterStatus,
  type Prisma,
} from '@prisma/client';
import type {
  MarketingSendResultDto,
  NewsletterListResponse,
  NewsletterSubscribeResponse,
  NewsletterSubscriberDto,
  NewsletterUnsubscribeResponse,
} from '@lumea/types';
import {
  marketingSendSchema,
  newsletterAdminListQuerySchema,
  newsletterSubscribeSchema,
  newsletterUnsubscribeSchema,
} from '@lumea/validation';
import { PrismaService } from '../prisma/prisma.service';
import { SesMailService } from './ses-mail.service';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: SesMailService,
  ) {}

  unsubscribeToken(email: string): string {
    const normalized = email.trim().toLowerCase();
    return createHmac('sha256', this.tokenSecret())
      .update(`newsletter:${normalized}`)
      .digest('hex')
      .slice(0, 48);
  }

  unsubscribeUrl(email: string): string {
    const normalized = email.trim().toLowerCase();
    const token = this.unsubscribeToken(normalized);
    const base = this.mail.getStorefrontUrl();
    return `${base}/newsletter/unsubscribe?email=${encodeURIComponent(normalized)}&token=${encodeURIComponent(token)}`;
  }

  verifyUnsubscribeToken(email: string, token: string): boolean {
    const expected = this.unsubscribeToken(email);
    const a = Buffer.from(expected);
    const b = Buffer.from(token.trim());
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  async subscribe(input: unknown): Promise<NewsletterSubscribeResponse> {
    const parsed = newsletterSubscribeSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const email = parsed.data.email.trim().toLowerCase();
    const locale = (parsed.data.locale as Locale | undefined) ?? null;
    const source = parsed.data.source?.trim() || 'footer';

    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existing?.status === NewsletterStatus.SUBSCRIBED) {
      return { ok: true, alreadySubscribed: true };
    }

    if (existing) {
      await this.prisma.newsletterSubscriber.update({
        where: { email },
        data: {
          status: NewsletterStatus.SUBSCRIBED,
          subscribedAt: new Date(),
          unsubscribedAt: null,
          locale: locale ?? existing.locale,
          source,
        },
      });
    } else {
      await this.prisma.newsletterSubscriber.create({
        data: {
          email,
          locale,
          source,
          status: NewsletterStatus.SUBSCRIBED,
        },
      });
    }

    const result = await this.mail.sendNewsletterWelcome({
      to: email,
      unsubscribeUrl: this.unsubscribeUrl(email),
    });
    if (!result.sent) {
      this.logger.log(
        `[newsletter] welcome ${email} skipped=${result.skippedReason ?? 'unknown'}`,
      );
    }

    return { ok: true };
  }

  async unsubscribe(input: unknown): Promise<NewsletterUnsubscribeResponse> {
    const parsed = newsletterUnsubscribeSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const email = parsed.data.email.trim().toLowerCase();
    if (!this.verifyUnsubscribeToken(email, parsed.data.token)) {
      throw new BadRequestException('Invalid unsubscribe link');
    }

    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email },
    });
    if (!existing) {
      return { ok: true, alreadyUnsubscribed: true };
    }
    if (existing.status === NewsletterStatus.UNSUBSCRIBED) {
      return { ok: true, alreadyUnsubscribed: true };
    }

    await this.prisma.newsletterSubscriber.update({
      where: { email },
      data: {
        status: NewsletterStatus.UNSUBSCRIBED,
        unsubscribedAt: new Date(),
      },
    });

    return { ok: true };
  }

  async listAdmin(query: unknown): Promise<NewsletterListResponse> {
    const parsed = newsletterAdminListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const { page, pageSize, status, locale, q } = parsed.data;
    const where: Prisma.NewsletterSubscriberWhereInput = {
      ...(status === 'all' ? {} : { status: status as NewsletterStatus }),
      ...(locale && locale !== 'all' ? { locale: locale as Locale } : {}),
      ...(q?.trim()
        ? { email: { contains: q.trim(), mode: 'insensitive' as const } }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.newsletterSubscriber.count({ where }),
      this.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { subscribedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        email: row.email,
        locale: row.locale as NewsletterSubscriberDto['locale'],
        status: row.status,
        source: row.source,
        subscribedAt: row.subscribedAt.toISOString(),
        unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async countActive(locale?: Locale | null): Promise<number> {
    return this.prisma.newsletterSubscriber.count({
      where: {
        status: NewsletterStatus.SUBSCRIBED,
        ...(locale ? { locale } : {}),
      },
    });
  }

  async sendMarketing(input: unknown): Promise<MarketingSendResultDto> {
    const parsed = marketingSendSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const data = parsed.data;
    const audience = data.audience ?? 'explicit';
    let recipients: string[] = [];

    if (audience === 'newsletter') {
      const rows = await this.prisma.newsletterSubscriber.findMany({
        where: {
          status: NewsletterStatus.SUBSCRIBED,
          ...(data.locale ? { locale: data.locale as Locale } : {}),
        },
        select: { email: true },
        take: 500,
        orderBy: { subscribedAt: 'asc' },
      });
      recipients = rows.map((r) => r.email);
    } else {
      recipients = (
        Array.isArray(data.to) ? data.to : data.to ? [data.to] : []
      ).map((e) => e.trim().toLowerCase());
    }

    const unique = [...new Set(recipients)];
    if (data.dryRun) {
      return {
        ok: true,
        dryRun: true,
        sesConfigured: this.mail.isConfigured(),
        audience,
        recipientCount: unique.length,
        sent: 0,
        failed: 0,
        skipped: 0,
        previewRecipients: unique.slice(0, 20),
      };
    }

    if (!unique.length) {
      return {
        ok: false,
        dryRun: false,
        sesConfigured: this.mail.isConfigured(),
        audience,
        recipientCount: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        skippedReason: 'no-recipients',
      };
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let lastMessageId: string | null = null;
    let lastSkipped: string | null = null;

    for (const email of unique) {
      const unsub =
        audience === 'newsletter' ? this.unsubscribeUrl(email) : undefined;
      const result = await this.mail.sendMarketing({
        to: email,
        subject: data.subject,
        previewText: data.previewText,
        bodyHtml: data.bodyHtml,
        bodyText: data.bodyText,
        unsubscribeUrl: unsub,
      });
      if (result.sent) {
        sent += 1;
        lastMessageId = result.messageId ?? lastMessageId;
      } else if (result.skippedReason?.startsWith('ses-error:')) {
        failed += 1;
        lastSkipped = result.skippedReason;
      } else {
        skipped += 1;
        lastSkipped = result.skippedReason ?? lastSkipped;
      }
    }

    return {
      ok: sent > 0 || (skipped > 0 && failed === 0 && !this.mail.isConfigured()),
      dryRun: false,
      sesConfigured: this.mail.isConfigured(),
      audience,
      recipientCount: unique.length,
      sent,
      failed,
      skipped,
      messageId: lastMessageId,
      skippedReason: lastSkipped,
    };
  }

  private tokenSecret(): string {
    return (
      process.env.NEWSLETTER_UNSUBSCRIBE_SECRET?.trim() ||
      process.env.JWT_SECRET?.trim() ||
      'dev-newsletter-secret'
    );
  }
}
