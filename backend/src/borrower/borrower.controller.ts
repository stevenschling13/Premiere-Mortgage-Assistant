import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BorrowerService } from './borrower.service';
import { CreateBorrowerDto } from './dto/create-borrower.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('borrowers')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BorrowerController {
  constructor(private readonly borrowerService: BorrowerService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateBorrowerDto) {
    return this.borrowerService.create(user.organizationId, body);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.borrowerService.findAll(user.organizationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.borrowerService.findOne(user.organizationId, id);
  }
}
