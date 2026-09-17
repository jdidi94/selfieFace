import { Injectable, Logger } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  EmailLogStatus,
  EmailTemplateType,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  MailSendResult,
  MailTemplateType,
  OrderMailContext,
  SendMailInput,
} from './mail.types';
import { marketingEmail } from './templates/marketing';
import { adminLowStockEmail } from './templates/low-stock';
import {
  adminOrderNotifyEmail,
  orderCancelledEmail,
  orderConfirmationEmail,
  orderDeliveredEmail,
  orderShippedEmail,
} from './templates/order';
import { passwordResetEmail } from './templates/password-reset';
import { emailVerificationEmail } from './templates/email-verification';
import { newsletterWelcomeEmail } from './templates/newsletter-welcome';
import { restockEmail } from './templates/restock';

@Injectable()
export class SesMailService {
  private readonly logger = new Logger(SesMailService.name);
  private readonly client: SESClient | null;
  private readonly fromEmail: string | null;
  private readonly fromName: string;
  private readonly storefrontUrl: string;
  private readonly adminUrl: string;
  private readonly adminNotifyEmail: string | null;

  constructor(private readonly prisma: PrismaService) {
    const region = process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim();
    this.fromEmail = process.env.SES_FROM_EMAIL?.trim() || null;
    this.fromName = process.env.SES_FROM_NAME?.trim() || 'Selfieface';
    this.storefrontUrl = (
      process.env.CLIENT_URL ??
      process.env.PASSWORD_RESET_URL_CLIENT ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
    this.adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:3001').replace(/\/$/, '');
    this.adminNotifyEmail =
      process.env.SES_ADMIN_NOTIFY_EMAIL?.trim() ||
      process.env.ADMIN_NOTIFY_EMAIL?.trim() ||
      null;

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    const fromEmailValid = Boolean(this.fromEmail && this.fromEmail.includes('@'));
    if (this.fromEmail && !fromEmailValid) {
      this.logger.error(
        `SES_FROM_EMAIL must be a full address like noreply@yourdomain.com (got "${this.fromEmail}" — missing @). Mail disabled until fixed.`,
      );
    }

    if (fromEmailValid && region && accessKeyId && secretAccessKey) {
      this.client = new SESClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`SES mail enabled (region=${region}, from=${this.fromEmail})`);
    } else {
      this.client = null;
      this.logger.warn(
        'SES not configured — transactional mail will no-op. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SES_FROM_EMAIL (full email with @).',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.fromEmail);
  }

  getStorefrontUrl(): string {
    return this.storefrontUrl;
  }

  async sendRaw(input: SendMailInput): Promise<MailSendResult> {
    const recipients = (Array.isArray(input.to) ? input.to : [input.to])
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const templateType = (input.templateType ?? 'RAW') as EmailTemplateType;

    if (!recipients.length) {
      const result: MailSendResult = { sent: false, skippedReason: 'no-recipients' };
      await this.logSend(result, {
        to: '(none)',
        subject: input.subject,
        templateType,
        userId: input.userId,
        orderId: input.orderId,
      });
      return result;
    }

    if (!this.client || !this.fromEmail) {
      this.logger.log(
        `[mail:noop] to=${recipients.join(',')} subject=${JSON.stringify(input.subject)}`,
      );
      const result: MailSendResult = { sent: false, skippedReason: 'ses-not-configured' };
      await this.logSend(result, {
        to: recipients,
        subject: input.subject,
        templateType,
        userId: input.userId,
        orderId: input.orderId,
      });
      return result;
    }

    try {
      const sesResult = await this.client.send(
        new SendEmailCommand({
          Source: `${this.fromName} <${this.fromEmail}>`,
          Destination: { ToAddresses: recipients },
          ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
          Message: {
            Subject: { Data: input.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: input.html, Charset: 'UTF-8' },
              Text: { Data: input.text, Charset: 'UTF-8' },
            },
          },
        }),
      );
      const result: MailSendResult = { sent: true, messageId: sesResult.MessageId };
      await this.logSend(result, {
        to: recipients,
        subject: input.subject,
        templateType,
        userId: input.userId,
        orderId: input.orderId,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const name = err instanceof Error ? err.name : 'unknown';
      this.logger.error(`SES send failed: ${message}`);
      if (name === 'AccessDenied' || message.includes('not authorized')) {
        this.logger.error(
          `SES IAM: grant ses:SendEmail/ses:SendRawEmail on identity "${this.fromEmail}" (and domain) in region ${process.env.AWS_REGION ?? '?'}. Current From must be a verified SES identity.`,
        );
      }
      const result: MailSendResult = { sent: false, skippedReason: `ses-error:${message}` };
      await this.logSend(result, {
        to: recipients,
        subject: input.subject,
        templateType,
        userId: input.userId,
        orderId: input.orderId,
      });
      return result;
    }
  }

  async sendPasswordReset(opts: {
    to: string;
    resetUrl: string;
    firstName?: string | null;
    userId?: string | null;
  }): Promise<MailSendResult> {
    const tpl = passwordResetEmail(opts);
    return this.sendRaw({
      to: opts.to,
      ...tpl,
      templateType: 'PASSWORD_RESET',
      userId: opts.userId,
    });
  }

  async sendEmailVerification(opts: {
    to: string;
    verifyUrl: string;
    firstName?: string | null;
    userId?: string | null;
  }): Promise<MailSendResult> {
    const tpl = emailVerificationEmail(opts);
    return this.sendRaw({
      to: opts.to,
      ...tpl,
      templateType: 'EMAIL_VERIFICATION',
      userId: opts.userId,
    });
  }

  async sendRestock(opts: {
    to: string;
    productName: string;
    productSlug: string;
    variantLabel?: string | null;
  }): Promise<MailSendResult> {
    const productUrl = `${this.storefrontUrl}/shop/${opts.productSlug}`;
    const tpl = restockEmail({
      productName: opts.productName,
      productUrl,
      variantLabel: opts.variantLabel,
    });
    return this.sendRaw({ to: opts.to, ...tpl, templateType: 'RESTOCK' });
  }

  async sendOrderConfirmation(ctx: OrderMailContext): Promise<MailSendResult> {
    const tpl = orderConfirmationEmail(this.withOrderDefaults(ctx));
    return this.sendRaw({
      to: ctx.email,
      ...tpl,
      templateType: 'ORDER_CONFIRMATION',
      orderId: ctx.orderId,
      userId: ctx.userId,
    });
  }

  async sendOrderShipped(ctx: OrderMailContext): Promise<MailSendResult> {
    const tpl = orderShippedEmail(this.withOrderDefaults(ctx));
    return this.sendRaw({
      to: ctx.email,
      ...tpl,
      templateType: 'ORDER_SHIPPED',
      orderId: ctx.orderId,
      userId: ctx.userId,
    });
  }

  async sendOrderDelivered(ctx: OrderMailContext): Promise<MailSendResult> {
    const tpl = orderDeliveredEmail(this.withOrderDefaults(ctx));
    return this.sendRaw({
      to: ctx.email,
      ...tpl,
      templateType: 'ORDER_DELIVERED',
      orderId: ctx.orderId,
      userId: ctx.userId,
    });
  }

  async sendOrderCancelled(ctx: OrderMailContext): Promise<MailSendResult> {
    const tpl = orderCancelledEmail(this.withOrderDefaults(ctx));
    return this.sendRaw({
      to: ctx.email,
      ...tpl,
      templateType: 'ORDER_CANCELLED',
      orderId: ctx.orderId,
      userId: ctx.userId,
    });
  }

  async notifyAdminNewOrder(ctx: OrderMailContext): Promise<MailSendResult> {
    if (!this.adminNotifyEmail) {
      return { sent: false, skippedReason: 'admin-notify-not-configured' };
    }
    const tpl = adminOrderNotifyEmail(this.withOrderDefaults(ctx));
    return this.sendRaw({
      to: this.adminNotifyEmail,
      ...tpl,
      templateType: 'ADMIN_ORDER_NOTIFY',
      orderId: ctx.orderId,
    });
  }

  async notifyAdminLowStock(opts: {
    productName: string;
    variantName: string;
    sku: string;
    stock: number;
    threshold: number;
  }): Promise<MailSendResult> {
    if (!this.adminNotifyEmail) {
      return { sent: false, skippedReason: 'admin-notify-not-configured' };
    }
    const tpl = adminLowStockEmail({
      ...opts,
      inventoryUrl: `${this.adminUrl}/catalog/inventory`,
    });
    return this.sendRaw({
      to: this.adminNotifyEmail,
      ...tpl,
      templateType: 'ADMIN_LOW_STOCK',
    });
  }

  async sendMarketing(opts: {
    to: string | string[];
    subject: string;
    previewText?: string;
    bodyHtml: string;
    bodyText?: string;
    unsubscribeUrl?: string;
  }): Promise<MailSendResult> {
    const text =
      opts.bodyText?.trim() ||
      opts.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const tpl = marketingEmail({
      subject: opts.subject,
      previewText: opts.previewText,
      bodyHtml: opts.bodyHtml,
      bodyText: text,
      unsubscribeUrl: opts.unsubscribeUrl,
    });
    return this.sendRaw({ to: opts.to, ...tpl, templateType: 'MARKETING' });
  }

  async sendNewsletterWelcome(opts: {
    to: string;
    unsubscribeUrl: string;
  }): Promise<MailSendResult> {
    const tpl = newsletterWelcomeEmail({
      shopUrl: `${this.storefrontUrl}/shop`,
      unsubscribeUrl: opts.unsubscribeUrl,
    });
    return this.sendRaw({
      to: opts.to,
      ...tpl,
      templateType: 'NEWSLETTER_WELCOME',
    });
  }

  private withOrderDefaults(ctx: OrderMailContext): OrderMailContext {
    return {
      ...ctx,
      storefrontUrl: ctx.storefrontUrl || this.storefrontUrl,
      orderUrl:
        ctx.orderUrl ??
        `${this.storefrontUrl}/account/orders`,
      customerName: ctx.customerName?.trim() || 'there',
    };
  }

  private async logSend(
    result: MailSendResult,
    meta: {
      to: string | string[];
      subject: string;
      templateType: EmailTemplateType | MailTemplateType;
      userId?: string | null;
      orderId?: string | null;
    },
  ): Promise<void> {
    const recipients = Array.isArray(meta.to) ? meta.to : [meta.to];
    const status = result.sent
      ? EmailLogStatus.SENT
      : result.skippedReason?.startsWith('ses-error:')
        ? EmailLogStatus.FAILED
        : EmailLogStatus.SKIPPED;
    const error = result.sent ? null : (result.skippedReason ?? null);
    const rows: Prisma.EmailLogCreateManyInput[] = recipients.map((to) => ({
      to,
      subject: meta.subject.slice(0, 500),
      templateType: meta.templateType as EmailTemplateType,
      status,
      providerMessageId: result.messageId ?? null,
      error: error?.slice(0, 2000) ?? null,
      userId: meta.userId ?? null,
      orderId: meta.orderId ?? null,
    }));

    try {
      await this.prisma.emailLog.createMany({ data: rows });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`EmailLog write failed: ${message}`);
    }
  }
}
