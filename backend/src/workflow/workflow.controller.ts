import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowRuleDto } from './dto/create-workflow-rule.dto';
import { UpdateWorkflowRuleDto } from './dto/update-workflow-rule.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('workflow-rules')
@UseGuards(JwtAuthGuard, TenantGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateWorkflowRuleDto) {
    return this.workflowService.create(user.organizationId, body);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.workflowService.findAll(user.organizationId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateWorkflowRuleDto,
  ) {
    return this.workflowService.update(user.organizationId, id, body);
  }
}
