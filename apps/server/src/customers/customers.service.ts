import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Currency, Locale } from '@prisma/client';
import {
  Currency as SharedCurrency,
  Locale as SharedLocale,
  type AdminCustomerListResponse,
  type CustomerProfileDto,
} from '@lumea/types';
import {
  adminCustomerListQuerySchema,
  customerProfileUpdateSchema,
} from '@lumea/validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private mapProfile(row: {
    id: string;
    phone: string | null;
    preferredLocale: Locale | null;
    preferredCurrency: Currency | null;
    user: {
      email: string;
      firstName: string | null;
      lastName: string | null;
    } | null;
  }): CustomerProfileDto {
    return {
      id: row.id,
      email: row.user?.email ?? (row.phone ? `guest:${row.phone}` : 'guest'),
      firstName: row.user?.firstName ?? null,
      lastName: row.user?.lastName ?? null,
      phone: row.phone,
      preferredLocale: row.preferredLocale as SharedLocale | null,
      preferredCurrency: row.preferredCurrency as SharedCurrency | null,
    };
  }

  async getProfile(userId: string): Promise<CustomerProfileDto> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    if (!customer) throw new ForbiddenException('Customer profile required');
    return this.mapProfile(customer);
  }

  async updateProfile(userId: string, input: unknown): Promise<CustomerProfileDto> {
    const parsed = customerProfileUpdateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new ForbiddenException('Customer profile required');

    const userData: { firstName?: string | null; lastName?: string | null } = {};
    if (parsed.data.firstName !== undefined) userData.firstName = parsed.data.firstName;
    if (parsed.data.lastName !== undefined) userData.lastName = parsed.data.lastName;

    const customerData: {
      phone?: string | null;
      preferredLocale?: Locale | null;
      preferredCurrency?: Currency | null;
    } = {};
    if (parsed.data.phone !== undefined) customerData.phone = parsed.data.phone;
    if (parsed.data.preferredLocale !== undefined) {
      customerData.preferredLocale = parsed.data.preferredLocale as Locale | null;
    }
    if (parsed.data.preferredCurrency !== undefined) {
      customerData.preferredCurrency = parsed.data.preferredCurrency as Currency | null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length) {
        await tx.user.update({ where: { id: userId }, data: userData });
      }
      return tx.customer.update({
        where: { id: customer.id },
        data: customerData,
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      });
    });

    return this.mapProfile(updated);
  }

  async listAdmin(query: unknown): Promise<AdminCustomerListResponse> {
    const parsed = adminCustomerListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const where = parsed.data.q?.trim()
      ? {
          OR: [
            {
              user: {
                OR: [
                  { email: { contains: parsed.data.q.trim(), mode: 'insensitive' as const } },
                  { firstName: { contains: parsed.data.q.trim(), mode: 'insensitive' as const } },
                  { lastName: { contains: parsed.data.q.trim(), mode: 'insensitive' as const } },
                ],
              },
            },
            { phone: { contains: parsed.data.q.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          loyaltyAccount: { select: { balance: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parsed.data.page - 1) * parsed.data.pageSize,
        take: parsed.data.pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        email: row.user?.email ?? (row.phone ? `guest:${row.phone}` : 'guest'),
        firstName: row.user?.firstName ?? null,
        lastName: row.user?.lastName ?? null,
        phone: row.phone,
        orderCount: row._count.orders,
        loyaltyBalance: row.loyaltyAccount?.balance ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    };
  }

  async getAdmin(id: string): Promise<
    CustomerProfileDto & { orderCount: number; createdAt: string; loyaltyBalance: number | null }
  > {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        loyaltyAccount: { select: { balance: true } },
        _count: { select: { orders: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return {
      ...this.mapProfile(customer),
      orderCount: customer._count.orders,
      loyaltyBalance: customer.loyaltyAccount?.balance ?? null,
      createdAt: customer.createdAt.toISOString(),
    };
  }
}
