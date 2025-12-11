import { Module, forwardRef } from '@nestjs/common';
import { LoanApplicationService } from './loan-application.service';
import { LoanApplicationController } from './loan-application.controller';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [forwardRef(() => WorkflowModule)],
  providers: [LoanApplicationService],
  controllers: [LoanApplicationController],
  exports: [LoanApplicationService],
})
export class LoanApplicationModule {}
