import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, TenantGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateUserDto) {
    return this.userService.create(user.organizationId, body);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.findAll(user.organizationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.userService.findOne(user.organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.userService.update(user.organizationId, id, body);
  }
}
