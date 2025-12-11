import { IsBoolean, IsEnum, IsObject, IsOptional } from 'class-validator';
import { WorkflowTriggerType } from '../../common/prisma-enums';

export class UpdateWorkflowRuleDto {
  @IsOptional()
  @IsEnum(WorkflowTriggerType)
  triggerType?: WorkflowTriggerType;

  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  actionConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
