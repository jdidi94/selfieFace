import { Module } from '@nestjs/common';
import { CacheModule } from '../common/cache/cache.module';
import { MarketsModule } from '../markets/markets.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TaxonomyController } from './taxonomy.controller';
import { AdminTaxonomyController } from './admin-taxonomy.controller';
import { TaxonomyAdminService } from './taxonomy-admin.service';

@Module({ imports: [PrismaModule, MarketsModule, CacheModule], controllers: [TaxonomyController, AdminTaxonomyController], providers: [TaxonomyAdminService] })
export class TaxonomyModule {}
