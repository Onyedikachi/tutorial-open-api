import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountConsentGuard } from './guards/account-consent.guard';
import { ConsentRequest } from '../auth/entities/consent-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ConsentRequest])],
  controllers: [AccountsController],
  providers: [AccountsService, AccountConsentGuard],
})
export class AccountsModule {}