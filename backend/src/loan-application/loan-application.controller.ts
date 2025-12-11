import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LoanApplicationService } from './loan-application.service';
import { CreateLoanApplicationDto } from './dto/create-loan-application.dto';
import { UpdateLoanApplicationDto } from './dto/update-loan-application.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('loan-applications')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LoanApplicationController {
  constructor(private readonly service: LoanApplicationService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoanApplicationDto) {
    return this.service.create(user.organizationId, body);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.organizationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.findOne(user.organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateLoanApplicationDto,
  ) {
    return this.service.update(user.organizationId, id, body);
  }
}
