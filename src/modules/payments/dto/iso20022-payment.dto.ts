import { IsString, IsNumber, IsDate, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class AccountIdentification {
  @IsString()
  iban: string;

  @IsString()
  currency: string;
}

class Amount {
  @IsNumber()
  value: number;

  @IsString()
  currency: string;
}

class PartyIdentification {
  @IsString()
  name: string;

  @ValidateNested()
  @Type(() => AccountIdentification)
  account: AccountIdentification;
}

export class ISO20022PaymentDTO {
  @IsString()
  messageId: string;

  @IsDate()
  creationDateTime: Date;

  @ValidateNested()
  @Type(() => PartyIdentification)
  debtor: PartyIdentification;

  @ValidateNested()
  @Type(() => PartyIdentification)
  creditor: PartyIdentification;

  @ValidateNested()
  @Type(() => Amount)
  instructedAmount: Amount;

  @IsString()
  remittanceInformation: string;
}

// Payment Status Report (PIST)
export class PaymentStatusReportDTO {
  @IsString()
  originalMessageId: string;

  @IsString()
  status: 'ACCP' | 'ACSC' | 'RJCT';

  @IsArray()
  statusReason?: string[];

  @IsDate()
  statusDateTime: Date;
}