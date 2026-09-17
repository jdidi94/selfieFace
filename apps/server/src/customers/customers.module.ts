import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { AdminCustomersController } from './admin-customers.controller';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [AuthModule],
  controllers: [CustomersController, AddressesController, AdminCustomersController],
  providers: [CustomersService, AddressesService],
  exports: [CustomersService, AddressesService],
})
export class CustomersModule {}
