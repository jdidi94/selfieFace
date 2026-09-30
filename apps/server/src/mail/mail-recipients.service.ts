import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import type { MarketCode, MailRecipientDto } from '@lumea/types';
import { mailRecipientUpsertSchema } from '@lumea/validation';
import { MarketsService } from '../markets/markets.service';
import { PrismaService } from '../prisma/prisma.service';
import { SesMailService } from './ses-mail.service';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

@Injectable()
export class MailRecipientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketsService: MarketsService,
    private readonly mail: SesMailService,
  ) {}

  async list(marketCode: MarketCode | string): Promise<MailRecipientDto[]> {
    const market = await this.marketsService.getByCode(marketCode);
    const rows = await this.prisma.mailRecipient.findMany({
      where: { marketId: market.id },
      orderBy: [{ type: 'asc' }, { email: 'asc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async create(input: unknown, marketCode: MarketCode | string): Promise<MailRecipientDto> {
    const parsed = mailRecipientUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const market = await this.marketsService.getByCode(marketCode);
    const existing = await this.prisma.mailRecipient.findUnique({
      where: {
        marketId_email_type: {
          marketId: market.id,
          email: parsed.data.email,
          type: parsed.data.type,
        },
      },
    });
    if (existing?.verifiedAt) return this.toDto(existing);
    const row = await this.issueVerification(existing?.id, {
      marketId: market.id,
      email: parsed.data.email,
      type: parsed.data.type,
    });
    return this.toDto(row);
  }

  async resend(id: string, marketCode: MarketCode | string): Promise<MailRecipientDto> {
    const market = await this.marketsService.getByCode(marketCode);
    const existing = await this.prisma.mailRecipient.findFirst({
      where: { id, marketId: market.id },
    });
    if (!existing) throw new NotFoundException('Mail recipient not found');
    if (existing.verifiedAt) return this.toDto(existing);
    const row = await this.issueVerification(existing.id, {
      marketId: market.id,
      email: existing.email,
      type: existing.type,
    });
    return this.toDto(row);
  }

  async remove(id: string, marketCode: MarketCode | string) {
    const market = await this.marketsService.getByCode(marketCode);
    const result = await this.prisma.mailRecipient.deleteMany({
      where: { id, marketId: market.id },
    });
    if (!result.count) throw new NotFoundException('Mail recipient not found');
    return { success: true };
  }

  async verify(rawToken: string) {
    const token = rawToken.trim();
    if (token.length < 32 || token.length > 256) {
      throw new BadRequestException('Verification link is invalid or expired');
    }
    const row = await this.prisma.mailRecipient.findUnique({
      where: { verificationTokenHash: this.hash(token) },
    });
    if (!row || !row.verificationExpiresAt || row.verificationExpiresAt <= new Date()) {
      throw new BadRequestException('Verification link is invalid or expired');
    }
    const verified = await this.prisma.mailRecipient.update({
      where: { id: row.id },
      data: {
        verifiedAt: new Date(),
        verificationTokenHash: null,
        verificationExpiresAt: null,
      },
    });
    return { verified: true, email: verified.email, type: verified.type };
  }

  private async issueVerification(
    existingId: string | undefined,
    data: { marketId: string; email: string; type: 'NEW_ORDER' | 'STOCK_ALERT' },
  ) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const row = existingId
      ? await this.prisma.mailRecipient.update({
          where: { id: existingId },
          data: {
            verificationTokenHash: this.hash(token),
            verificationExpiresAt: expiresAt,
          },
        })
      : await this.prisma.mailRecipient.create({
          data: {
            ...data,
            verificationTokenHash: this.hash(token),
            verificationExpiresAt: expiresAt,
          },
        });
    const verifyUrl = `${this.mail.getStorefrontUrl()}/mail/recipients/verify?token=${encodeURIComponent(token)}`;
    const safeEmail = escapeHtml(row.email);
    const safeUrl = escapeHtml(verifyUrl);
    await this.mail.sendRaw({
      to: row.email,
      subject: 'Verify Selfieface alert recipient',
      html: `<p>Confirm that this address can receive Selfieface ${row.type === 'NEW_ORDER' ? 'new order' : 'stock alert'} notifications.</p><p><a href="${safeUrl}">Verify email address</a></p><p>This link expires in 24 hours.</p><p>Address: ${safeEmail}</p>`,
      text: `Confirm this address for Selfieface ${row.type === 'NEW_ORDER' ? 'new order' : 'stock alert'} notifications: ${verifyUrl}\n\nThis link expires in 24 hours.`,
      templateType: 'RAW',
      marketId: row.marketId,
    });
    return row;
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private toDto(row: {
    id: string;
    email: string;
    type: string;
    verifiedAt: Date | null;
    createdAt: Date;
  }): MailRecipientDto {
    return {
      id: row.id,
      email: row.email,
      type: row.type as MailRecipientDto['type'],
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
