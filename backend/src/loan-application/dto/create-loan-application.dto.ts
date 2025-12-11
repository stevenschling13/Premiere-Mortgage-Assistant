import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { LoanStatus } from '../../common/prisma-enums';

export class CreateLoanApplicationDto {
  @IsUUID()
  borrowerId!: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsString()
  loanType!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;
}
