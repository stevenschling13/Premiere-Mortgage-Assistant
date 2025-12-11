import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { LoanStatus } from '../../common/prisma-enums';

export class UpdateLoanApplicationDto {
  @IsOptional()
  @IsString()
  loanType?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;
}
