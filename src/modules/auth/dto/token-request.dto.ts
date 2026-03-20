import { IsString, IsOptional, IsIn } from 'class-validator';

export class TokenRequestDTO {
  @IsString()
  @IsIn(['authorization_code', 'refresh_token', 'client_credentials'])
  grant_type: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  refresh_token?: string;

  @IsOptional()
  @IsString()
  redirect_uri?: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  client_secret?: string;

  @IsOptional()
  @IsString()
  code_verifier?: string;
}