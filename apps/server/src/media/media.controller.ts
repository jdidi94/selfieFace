import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get(':id')
  async get(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { file, mimeType } = await this.mediaService.stream(id);
    res.set({
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
    });
    return file;
  }
}
