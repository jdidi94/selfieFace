import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { processUploadBuffer } from './image-compress';

@Injectable()
export class MediaService {
  private readonly uploadDir = join(process.cwd(), 'uploads');

  constructor(private readonly prisma: PrismaService) {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Public path stored in DB — always `/api/media/:id` so existing IDs keep working.
   * Clients rewrite via `NEXT_PUBLIC_MEDIA_URL` / `MEDIA_PUBLIC_BASE_URL` when a CDN is set.
   */
  publicUrlForId(id: string): string {
    return `/api/media/${id}`;
  }

  async saveUpload(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');

    const id = randomUUID();
    const processed = await processUploadBuffer(
      file.buffer,
      file.mimetype,
      file.originalname,
    );

    const ext =
      processed.compressed
        ? processed.extension
        : extname(file.originalname) || processed.extension || '';
    const storedName = `${id}${ext}`;
    const absolutePath = join(this.uploadDir, storedName);

    writeFileSync(absolutePath, processed.buffer);

    return this.prisma.media.create({
      data: {
        id,
        filename: file.originalname,
        mimeType: processed.mimeType,
        size: processed.buffer.length,
        path: absolutePath,
        url: this.publicUrlForId(id),
        width: processed.width,
        height: processed.height,
      },
    });
  }

  async stream(id: string): Promise<{ file: StreamableFile; mimeType: string }> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media || !existsSync(media.path)) {
      throw new NotFoundException('Media not found');
    }
    return {
      file: new StreamableFile(createReadStream(media.path)),
      mimeType: media.mimeType,
    };
  }
}
