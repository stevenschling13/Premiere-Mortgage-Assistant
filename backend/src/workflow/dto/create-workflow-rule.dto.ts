import { IsBoolean, IsEnum, IsObject, IsOptional } from 'class-validator';
import { WorkflowTriggerType } from '../../common/prisma-enums';

export class CreateWorkflowRuleDto {
  @IsEnum(WorkflowTriggerType)
  triggerType!: WorkflowTriggerType;

  @IsObject()
  triggerConfig!: Record<string, unknown>;

  @IsObject()
  actionConfig!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
