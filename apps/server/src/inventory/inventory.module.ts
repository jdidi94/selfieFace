import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { MarketsModule } from '../markets/markets.module';
import { AdminToolsModule } from '../admin-tools/admin-tools.module';
import { AdminInventoryController } from './admin-inventory.controller';
import { AdminWarehousesController } from './admin-warehouses.controller';
import { InventoryService } from './inventory.service';
import { WarehousesService } from './warehouses.service';

@Module({
  imports: [CommerceModule, MarketsModule, AdminToolsModule],
  controllers: [AdminInventoryController, AdminWarehousesController],
  providers: [InventoryService, WarehousesService],
  exports: [InventoryService, WarehousesService],
})
export class InventoryModule {}
