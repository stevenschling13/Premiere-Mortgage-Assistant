import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { LeadStatus } from '../../common/prisma-enums';

export class CreateLeadDto {
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
