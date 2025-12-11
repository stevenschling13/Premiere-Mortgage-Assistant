import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowRuleDto } from './dto/create-workflow-rule.dto';
import { UpdateWorkflowRuleDto } from './dto/update-workflow-rule.dto';
import { WorkflowTriggerType } from '../common/prisma-enums';
import { OutboundEventService } from '../outbound-event/outbound-event.service';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboundEvents: OutboundEventService,
  ) {}

  create(organizationId: string, dto: CreateWorkflowRuleDto) {
    return this.prisma.workflowRule.create({
      data: { ...dto, organizationId, isActive: dto.isActive ?? true },
    });
  }

  findAll(organizationId: string) {
    return this.prisma.workflowRule.findMany({ where: { organizationId } });
  }

  async update(organizationId: string, id: string, dto: UpdateWorkflowRuleDto) {
    await this.ensureRule(organizationId, id);
    return this.prisma.workflowRule.update({ where: { id }, data: dto });
  }

  async handleEvent(organizationId: string, trigger: WorkflowTriggerType, context: Record<string, unknown>) {
    const rules = await this.prisma.workflowRule.findMany({ where: { organizationId, triggerType: trigger, isActive: true } });
    for (const rule of rules) {
      if (trigger === WorkflowTriggerType.STATUS_CHANGE) {
        const expected = (rule.triggerConfig as any)?.status;
        if (expected && expected !== context.status) {
          continue;
        }
      }
      await this.outboundEvents.enqueue(
        organizationId,
        (rule.actionConfig as any)?.eventType || 'workflow.triggered',
        {
          ruleId: rule.id,
          trigger,
          context,
          action: rule.actionConfig,
        },
      );
    }
  }

  private async ensureRule(organizationId: string, id: string) {
    const rule = await this.prisma.workflowRule.findFirst({ where: { id, organizationId } });
    if (!rule) {
      throw new NotFoundException('Workflow rule not found');
    }
    return rule;
  }
}
