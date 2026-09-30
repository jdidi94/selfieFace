import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Locale,
  Prisma,
  SupportTicketStatus as PrismaTicketStatus,
  SupportTicketTopic as PrismaTicketTopic,
} from '@prisma/client';
import {
  Locale as SharedLocale,
  SupportTicketStatus as SharedTicketStatus,
  SupportTicketTopic as SharedTicketTopic,
  type AdminSupportTicketListResponse,
  type MarketCode,
  type SupportTicketCreateResult,
  type SupportTicketDto,
  type SupportTicketLookupDto,
} from '@lumea/types';
import {
  adminSupportTicketListQuerySchema,
  localeSchema,
  supportTicketAdminUpdateSchema,
  supportTicketCreateSchema,
  supportTicketLookupSchema,
} from '@lumea/validation';
import { MarketsService } from '../markets/markets.service';
import {
  marketCodeFromCurrencyValue,
  parseMarketCode,
} from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';

const ticketInclude = {
  market: true,
  customer: { include: { user: { select: { email: true } } } },
  order: { select: { id: true, number: true } },
  attachments: { include: { media: true }, orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.SupportTicketInclude;

type TicketRow = Prisma.SupportTicketGetPayload<{ include: typeof ticketInclude }>;

function mapTicket(row: TicketRow): SupportTicketDto {
  return {
    id: row.id,
    topic: row.topic as SharedTicketTopic,
    status: row.status as SharedTicketStatus,
    subject: row.subject,
    message: row.message,
    name: row.name,
    email: row.email,
    locale: row.locale as SharedLocale,
    marketCode: row.market?.code ? (row.market.code as MarketCode) : undefined,
    orderNumber: row.orderNumber,
    adminNotes: row.adminNotes,
    customerId: row.customerId,
    customerEmail: row.customer?.user?.email ?? row.customer?.email ?? null,
    orderId: row.orderId,
    orderDisplayNumber: row.order?.number ?? null,
    attachments: (row.attachments ?? []).map((a) => ({
      id: a.id,
      mediaId: a.mediaId,
      url: a.media.url,
      filename: a.media.filename,
      mimeType: a.media.mimeType,
      sortOrder: a.sortOrder,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapTicketLookup(row: {
  id: string;
  status: PrismaTicketStatus;
  subject: string;
  createdAt: Date;
}): SupportTicketLookupDto {
  return {
    id: row.id,
    status: row.status as SharedTicketStatus,
    subject: row.subject,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketsService: MarketsService,
  ) {}

  private parseLocale(locale?: string): SharedLocale {
    return localeSchema.safeParse(locale).success
      ? (locale as SharedLocale)
      : SharedLocale.EN;
  }

  async createPublic(input: unknown): Promise<SupportTicketCreateResult> {
    const parsed = supportTicketCreateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const {
      topic,
      subject,
      message,
      name,
      email,
      locale,
      market,
      currency,
      orderNumber,
      mediaIds,
    } = parsed.data;

    const marketCode = market
      ? parseMarketCode(market)
      : marketCodeFromCurrencyValue(currency);
    const marketRow = await this.marketsService.getByCode(marketCode);
    const lang = this.parseLocale(locale);
    const emailNorm = email.trim().toLowerCase();

    let customerId: string | null = null;
    const byUser = await this.prisma.user.findUnique({
      where: { email: emailNorm },
      select: { customer: { select: { id: true } } },
    });
    customerId = byUser?.customer?.id ?? null;
    if (!customerId) {
      const byGuest = await this.prisma.customer.findFirst({
        where: { email: { equals: emailNorm, mode: 'insensitive' } },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      customerId = byGuest?.id ?? null;
    }

    let orderId: string | null = null;
    const orderNum = orderNumber?.trim() || null;
    if (orderNum) {
      const order = await this.prisma.order.findFirst({
        where: {
          number: { equals: orderNum, mode: 'insensitive' },
          marketId: marketRow.id,
        },
        select: { id: true, customerId: true },
      });
      if (order) {
        orderId = order.id;
        if (!customerId) customerId = order.customerId;
      }
    }

    const uniqueMediaIds = [...new Set(mediaIds ?? [])];
    if (uniqueMediaIds.length) {
      const found = await this.prisma.media.count({
        where: { id: { in: uniqueMediaIds } },
      });
      if (found !== uniqueMediaIds.length) {
        throw new BadRequestException('One or more attachments are invalid');
      }
    }

    const created = await this.prisma.supportTicket.create({
      data: {
        topic: topic as PrismaTicketTopic,
        subject: subject.trim(),
        message: message.trim(),
        name: name?.trim() || null,
        email: emailNorm,
        locale: lang as Locale,
        marketId: marketRow.id,
        customerId,
        orderId,
        orderNumber: orderNum,
        attachments: uniqueMediaIds.length
          ? {
              create: uniqueMediaIds.map((mediaId, index) => ({
                mediaId,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      select: { id: true, status: true },
    });

    return {
      id: created.id,
      status: created.status as SharedTicketStatus,
    };
  }

  async lookupPublic(input: unknown): Promise<SupportTicketLookupDto> {
    const parsed = supportTicketLookupSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const emailNorm = parsed.data.email.trim().toLowerCase();
    const row = await this.prisma.supportTicket.findFirst({
      where: {
        id: parsed.data.id,
        email: { equals: emailNorm, mode: 'insensitive' },
      },
      select: { id: true, status: true, subject: true, createdAt: true },
    });
    if (!row) throw new NotFoundException('Ticket not found');
    return mapTicketLookup(row);
  }

  async listMyTickets(userId: string): Promise<SupportTicketLookupDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        customer: { select: { id: true } },
      },
    });
    if (!user) return [];

    const emailNorm = user.email.trim().toLowerCase();
    const customerId = user.customer?.id ?? null;

    const rows = await this.prisma.supportTicket.findMany({
      where: {
        OR: [
          ...(customerId ? [{ customerId }] : []),
          { email: { equals: emailNorm, mode: 'insensitive' } },
        ],
      },
      select: { id: true, status: true, subject: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map(mapTicketLookup);
  }

  async listAdmin(
    marketCode: MarketCode | string = 'OTHER',
    query: unknown = {},
  ): Promise<AdminSupportTicketListResponse> {
    const parsed = adminSupportTicketListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { status, topic, q, page, pageSize } = parsed.data;
    const marketRow = await this.marketsService.getByCode(marketCode);

    const where: Prisma.SupportTicketWhereInput = {
      marketId: marketRow.id,
      ...(status ? { status: status as PrismaTicketStatus } : {}),
      ...(topic ? { topic: topic as PrismaTicketTopic } : {}),
      ...(q?.trim()
        ? {
            OR: [
              { subject: { contains: q.trim(), mode: 'insensitive' } },
              { message: { contains: q.trim(), mode: 'insensitive' } },
              { email: { contains: q.trim(), mode: 'insensitive' } },
              { name: { contains: q.trim(), mode: 'insensitive' } },
              { orderNumber: { contains: q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        include: ticketInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(mapTicket),
      total,
      page,
      pageSize,
    };
  }

  async getAdmin(id: string): Promise<SupportTicketDto> {
    const row = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: ticketInclude,
    });
    if (!row) throw new NotFoundException('Ticket not found');
    return mapTicket(row);
  }

  async updateAdmin(id: string, input: unknown): Promise<SupportTicketDto> {
    const parsed = supportTicketAdminUpdateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const existing = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ticket not found');

    const row = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...(parsed.data.status
          ? { status: parsed.data.status as PrismaTicketStatus }
          : {}),
        ...(parsed.data.adminNotes !== undefined
          ? { adminNotes: parsed.data.adminNotes?.trim() || null }
          : {}),
      },
      include: ticketInclude,
    });
    return mapTicket(row);
  }
}
