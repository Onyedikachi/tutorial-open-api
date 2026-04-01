import { Controller, Get, Param, Query, UseGuards, Req, Headers } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountConsentGuard } from './guards/account-consent.guard';
import { StatementQueryDTO } from './dto/statement.dto';
import { ProblemDetailsException } from '../../common/exceptions/problem-details.exception';

@Controller('past/accounts')
@UseGuards(AccountConsentGuard)
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Get(':accountId/statement')
  async getStatement(
    @Param('accountId') accountId: string,
    @Query() query: StatementQueryDTO,
    @Req() req,
  ) {
    // Validate date range
    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new ProblemDetailsException({
        type: 'https://api.openbanking.ng/errors/invalid-date',
        title: 'Invalid Date',
        status: 400,
        detail: 'from and to must be valid ISO 8601 dates',
        instance: req.path,
      });
    }
    if (fromDate > toDate) {
      throw new ProblemDetailsException({
        type: 'https://api.openbanking.ng/errors/invalid-date-range',
        title: 'Invalid Date Range',
        status: 400,
        detail: 'from date must be before to date',
        instance: req.path,
      });
    }

    // Fetch statement from service
    const transactions = await this.accountsService.getAccountStatement(
      accountId,
      fromDate,
      toDate,
      req.consent, // pass consent for audit
    );

    return { transactions };
  }
}