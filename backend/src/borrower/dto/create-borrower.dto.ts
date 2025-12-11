import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateBorrowerDto {
  @IsObject()
  primaryContact!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  coBorrowerInfo?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  leadId?: string;
}
