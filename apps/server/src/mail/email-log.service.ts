import { BadRequestException, Injectable } from '@nestjs/common';
import { EmailLogStatus, EmailTemplateType, type Prisma } from '@prisma/client';
import type { EmailLogListResponse } from '@lumea/types';
import { emailLogAdminListQuerySchema } from '@lumea/validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailLogService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmin(query: unknown): Promise<EmailLogListResponse> {
    const parsed = emailLogAdminListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const { page, pageSize, status, templateType, q } = parsed.data;
    const where: Prisma.EmailLogWhereInput = {
      ...(status !== 'all' ? { status: status as EmailLogStatus } : {}),
      ...(templateType &&
      Object.values(EmailTemplateType).includes(templateType as EmailTemplateType)
        ? { templateType: templateType as EmailTemplateType }
        : {}),
      ...(q?.trim()
        ? {
            OR: [
              { to: { contains: q.trim(), mode: 'insensitive' as const } },
              { subject: { contains: q.trim(), mode: 'insensitive' as const } },
              {
                providerMessageId: {
                  contains: q.trim(),
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.emailLog.count({ where }),
      this.prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        to: row.to,
        subject: row.subject,
        templateType: row.templateType,
        status: row.status,
        providerMessageId: row.providerMessageId,
        error: row.error,
        userId: row.userId,
        orderId: row.orderId,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }
}
