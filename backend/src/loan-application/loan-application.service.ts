import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLoanApplicationDto } from './dto/create-loan-application.dto';
import { UpdateLoanApplicationDto } from './dto/update-loan-application.dto';
import { LoanStatus, WorkflowTriggerType } from '../common/prisma-enums';
import { WorkflowService } from '../workflow/workflow.service';

@Injectable()
export class LoanApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WorkflowService)) private readonly workflowService: WorkflowService,
  ) {}

  async create(organizationId: string, dto: CreateLoanApplicationDto) {
    await this.ensureBorrower(organizationId, dto.borrowerId);
    if (dto.leadId) {
      await this.prisma.lead.updateMany({
        where: { id: dto.leadId, organizationId },
        data: { status: 'CONVERTED' },
      });
    }
    return this.prisma.loanApplication.create({
      data: {
        organizationId,
        borrowerId: dto.borrowerId,
        leadId: dto.leadId,
        loanType: dto.loanType,
        amount: dto.amount,
        status: dto.status ?? LoanStatus.DRAFT,
        stageHistory: [{ status: dto.status ?? LoanStatus.DRAFT, changedAt: new Date().toISOString() }],
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.loanApplication.findMany({ where: { organizationId } });
  }

  async findOne(organizationId: string, id: string) {
    const loan = await this.prisma.loanApplication.findFirst({ where: { id, organizationId } });
    if (!loan) {
      throw new NotFoundException('Loan application not found');
    }
    return loan;
  }

  async update(organizationId: string, id: string, dto: UpdateLoanApplicationDto) {
    const loan = await this.findOne(organizationId, id);
    const stageHistory = Array.isArray(loan.stageHistory) ? [...(loan.stageHistory as any[])] : [];
    if (dto.status && dto.status !== loan.status) {
      stageHistory.push({ status: dto.status, changedAt: new Date().toISOString() });
    }
    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: { ...dto, stageHistory },
    });
    if (dto.status && dto.status !== loan.status) {
      await this.workflowService.handleEvent(organizationId, WorkflowTriggerType.STATUS_CHANGE, {
        entity: 'loanApplication',
        loanId: id,
        status: dto.status,
      });
    }
    return updated;
  }

  private async ensureBorrower(organizationId: string, borrowerId: string) {
    const borrower = await this.prisma.borrower.findFirst({ where: { id: borrowerId, organizationId } });
    if (!borrower) {
      throw new NotFoundException('Borrower not found');
    }
  }
}
