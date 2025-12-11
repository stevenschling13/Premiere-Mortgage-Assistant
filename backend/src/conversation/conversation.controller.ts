import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('conversations')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateConversationDto) {
    return this.conversationService.create(user.organizationId, body);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('relatedEntityId') relatedEntityId?: string) {
    return this.conversationService.findAll(user.organizationId, relatedEntityId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.conversationService.findOne(user.organizationId, id);
  }
}
