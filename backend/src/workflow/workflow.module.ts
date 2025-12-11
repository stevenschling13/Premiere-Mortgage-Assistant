import { Module, forwardRef } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { OutboundEventModule } from '../outbound-event/outbound-event.module';

@Module({
  imports: [forwardRef(() => OutboundEventModule)],
  providers: [WorkflowService],
  controllers: [WorkflowController],
  exports: [WorkflowService],
})
export class WorkflowModule {}
