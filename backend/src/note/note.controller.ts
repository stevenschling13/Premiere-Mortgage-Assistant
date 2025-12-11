import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { NoteService } from './note.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notes')
@UseGuards(JwtAuthGuard, TenantGuard)
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateNoteDto) {
    return this.noteService.create(user.organizationId, user.userId, body);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('relatedEntityId') relatedEntityId?: string) {
    return this.noteService.findAll(user.organizationId, relatedEntityId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.noteService.findOne(user.organizationId, id);
  }
}
