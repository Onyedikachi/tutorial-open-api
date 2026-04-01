import { Injectable } from '@nestjs/common';

@Injectable()
export class AccountsService {
  async getAccountStatement(
    accountId: string,
    from: Date,
    to: Date,
    consent: any,
  ): Promise<any[]> {
    // TODO: Replace with real integration to core banking system
    // For now, return mock data
    console.log(`Fetching statement for account ${accountId} from ${from} to ${to} with consent ${consent.id}`);

    return [
      {
        date: '2026-04-01T00:00:00Z',
        description: 'Salary Credit',
        amount: 500000,
        balance: 1000000,
      },
      {
        date: '2026-04-02T00:00:00Z',
        description: 'ATM Withdrawal',
        amount: -50000,
        balance: 950000,
      },
      {
        date: '2026-04-03T00:00:00Z',
        description: 'Bill Payment',
        amount: -15000,
        balance: 935000,
      },
    ];
  }
}