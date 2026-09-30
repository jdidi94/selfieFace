import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { createConnection } from 'net';
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

  async saveCustomerUpload(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    await this.scanCustomerUpload(file.buffer);
    return this.saveUpload(file);
  }

  private async scanCustomerUpload(buffer: Buffer) {
    const host = process.env.CLAMAV_HOST?.trim();
    if (!host) {
      throw new ServiceUnavailableException('Customer uploads are unavailable until virus scanning is configured');
    }
    const port = Number.parseInt(process.env.CLAMAV_PORT ?? '3310', 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ServiceUnavailableException('Virus scanner configuration is invalid');
    }

    await new Promise<void>((resolve, reject) => {
      const socket = createConnection({ host, port });
      let response = '';
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (error) reject(error);
        else resolve();
      };
      const unavailable = () =>
        new ServiceUnavailableException('Virus scanning is temporarily unavailable; the upload was not saved');

      socket.setTimeout(15_000);
      socket.on('connect', () => {
        socket.write(Buffer.from('zINSTREAM\0'));
        for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
          const chunk = buffer.subarray(offset, Math.min(offset + 64 * 1024, buffer.length));
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length);
          socket.write(size);
          socket.write(chunk);
        }
        const terminator = Buffer.alloc(4);
        socket.write(terminator);
      });
      socket.on('data', (chunk: Buffer) => {
        response += chunk.toString('utf8');
        if (/\bFOUND\b/.test(response)) {
          finish(new BadRequestException('This file was rejected by the virus scanner'));
        } else if (/\bOK\b/.test(response)) {
          finish();
        } else if (/\bERROR\b/.test(response)) {
          finish(unavailable());
        }
      });
      socket.on('timeout', () => finish(unavailable()));
      socket.on('error', () => finish(unavailable()));
      socket.on('end', () => {
        if (!settled) finish(unavailable());
      });
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
