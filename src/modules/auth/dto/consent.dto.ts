import { IsBoolean, IsArray, IsString, IsUUID } from 'class-validator';

export class ConsentDTO {
  @IsUUID()
  consentId: string;

  @IsBoolean()
  approved: boolean;

  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}