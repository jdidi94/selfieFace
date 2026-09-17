import { Global, Module } from '@nestjs/common';
import { CatalogCacheService } from './catalog-cache.service';
import { MemoryCacheService } from './memory-cache.service';

@Global()
@Module({
  providers: [MemoryCacheService, CatalogCacheService],
  exports: [MemoryCacheService, CatalogCacheService],
})
export class CacheModule {}
