import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AddressDto } from '@lumea/types';
import { addressUpdateSchema, addressUpsertSchema } from '@lumea/validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapAddress(row: {
    id: string;
    label: string | null;
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string;
    country: string;
    phone: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AddressDto {
    return {
      id: row.id,
      label: row.label,
      fullName: row.fullName,
      line1: row.line1,
      line2: row.line2,
      city: row.city,
      region: row.region,
      postalCode: row.postalCode,
      country: row.country,
      phone: row.phone,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async requireCustomerId(userId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new ForbiddenException('Customer profile required');
    return customer.id;
  }

  async list(userId: string): Promise<AddressDto[]> {
    const customerId = await this.requireCustomerId(userId);
    const rows = await this.prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map((row) => this.mapAddress(row));
  }

  async create(userId: string, input: unknown): Promise<AddressDto> {
    const parsed = addressUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const customerId = await this.requireCustomerId(userId);
    const makeDefault = parsed.data.isDefault === true;

    const row = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      } else {
        const count = await tx.address.count({ where: { customerId } });
        if (count === 0) {
          // First address becomes default.
        }
      }

      const count = await tx.address.count({ where: { customerId } });
      const isDefault = makeDefault || count === 0;

      if (isDefault && !makeDefault) {
        // ensure uniqueness if somehow others exist
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          customerId,
          label: parsed.data.label ?? null,
          fullName: parsed.data.fullName,
          line1: parsed.data.line1,
          line2: parsed.data.line2 ?? null,
          city: parsed.data.city,
          region: parsed.data.region ?? null,
          postalCode: parsed.data.postalCode,
          country: parsed.data.country.toUpperCase(),
          phone: parsed.data.phone ?? null,
          isDefault,
        },
      });
    });

    return this.mapAddress(row);
  }

  async update(userId: string, id: string, input: unknown): Promise<AddressDto> {
    const parsed = addressUpdateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const customerId = await this.requireCustomerId(userId);
    const existing = await this.prisma.address.findFirst({
      where: { id, customerId },
    });
    if (!existing) throw new NotFoundException('Address not found');

    const row = await this.prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault === true) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id },
        data: {
          ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
          ...(parsed.data.fullName !== undefined ? { fullName: parsed.data.fullName } : {}),
          ...(parsed.data.line1 !== undefined ? { line1: parsed.data.line1 } : {}),
          ...(parsed.data.line2 !== undefined ? { line2: parsed.data.line2 } : {}),
          ...(parsed.data.city !== undefined ? { city: parsed.data.city } : {}),
          ...(parsed.data.region !== undefined ? { region: parsed.data.region } : {}),
          ...(parsed.data.postalCode !== undefined
            ? { postalCode: parsed.data.postalCode }
            : {}),
          ...(parsed.data.country !== undefined
            ? { country: parsed.data.country.toUpperCase() }
            : {}),
          ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
          ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
        },
      });
    });

    return this.mapAddress(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const customerId = await this.requireCustomerId(userId);
    const existing = await this.prisma.address.findFirst({
      where: { id, customerId },
    });
    if (!existing) throw new NotFoundException('Address not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });
      if (existing.isDefault) {
        const next = await tx.address.findFirst({
          where: { customerId },
          orderBy: { updatedAt: 'desc' },
        });
        if (next) {
          await tx.address.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });
  }

  /** Used by checkout to persist a shipping address for signed-in customers. */
  async saveFromShipping(
    customerId: string,
    address: {
      fullName: string;
      line1: string;
      line2?: string | null;
      city: string;
      region?: string | null;
      postalCode: string;
      country: string;
      phone?: string | null;
    },
    opts?: { label?: string | null; makeDefault?: boolean },
  ): Promise<AddressDto> {
    const count = await this.prisma.address.count({ where: { customerId } });
    const makeDefault = opts?.makeDefault === true || count === 0;

    const row = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: {
          customerId,
          label: opts?.label ?? null,
          fullName: address.fullName,
          line1: address.line1,
          line2: address.line2 ?? null,
          city: address.city,
          region: address.region ?? null,
          postalCode: address.postalCode,
          country: address.country.toUpperCase(),
          phone: address.phone ?? null,
          isDefault: makeDefault,
        },
      });
    });

    return this.mapAddress(row);
  }
}
