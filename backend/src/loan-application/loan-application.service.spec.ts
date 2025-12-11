import { LoanApplicationService } from './loan-application.service';
import { LoanStatus, WorkflowTriggerType } from '../common/prisma-enums';

describe('LoanApplicationService', () => {
  const borrowerId = 'borrower-1';
  const loanId = 'loan-1';
  const organizationId = 'org-1';
  const prisma = {
    borrower: {
      findFirst: jest.fn().mockResolvedValue({ id: borrowerId }),
    },
    lead: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    loanApplication: {
      create: jest.fn().mockResolvedValue({ id: loanId, stageHistory: [] }),
      findFirst: jest.fn().mockResolvedValue({ id: loanId, status: LoanStatus.DRAFT, stageHistory: [] }),
      update: jest.fn().mockImplementation(async ({ data }) => ({ id: loanId, ...data })),
    },
  } as any;

  const workflowService = {
    handleEvent: jest.fn().mockResolvedValue(undefined),
  } as any;

  const service = new LoanApplicationService(prisma, workflowService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a loan application and records initial stage history', async () => {
    const result = await service.create(organizationId, {
      borrowerId,
      loanType: 'Conventional',
      amount: 350000,
    });

    expect(prisma.loanApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ borrowerId, loanType: 'Conventional', amount: 350000 }),
      }),
    );
    expect(result).toBeDefined();
  });

  it('tracks status changes and triggers workflow', async () => {
    const updated = await service.update(organizationId, loanId, { status: LoanStatus.PROCESSING });
    expect(updated.stageHistory).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: LoanStatus.PROCESSING })]),
    );
    expect(workflowService.handleEvent).toHaveBeenCalledWith(
      organizationId,
      WorkflowTriggerType.STATUS_CHANGE,
      expect.objectContaining({ loanId, status: LoanStatus.PROCESSING }),
    );
  });
});
