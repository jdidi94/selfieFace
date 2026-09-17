import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminMailController } from '../mail/admin-mail.controller';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, AdminMailController],
})
export class AdminModule {}
