import { IsBoolean, IsArray, IsString, IsUUID, IsOptional } from 'class-validator';

export class ConsentDTO {
  @IsUUID()
  consentId: string;

  @IsBoolean()
  approved: boolean;

  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @IsArray()
  @IsString({ each: true })
  accounts: string[];

  // The authenticated PSU (bank customer) approving this consent, from the
  // bank-hosted mock login step (see consent-ui.controller.ts). Real bank
  // deployments would derive this from the PSU's actual authenticated
  // session, not a client-supplied field.
  @IsOptional()
  @IsString()
  userId?: string;
}