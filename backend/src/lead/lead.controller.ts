import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LeadService } from './lead.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('leads')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLeadDto) {
    return this.leadService.create(user.organizationId, body);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.leadService.findAll(user.organizationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leadService.findOne(user.organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateLeadDto,
  ) {
    return this.leadService.update(user.organizationId, id, body);
  }
}
