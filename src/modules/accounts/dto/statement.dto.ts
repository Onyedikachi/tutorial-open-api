import { IsString, IsDateString, IsOptional } from 'class-validator';

export class StatementQueryDTO {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}