import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NoteService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, authorUserId: string, dto: CreateNoteDto) {
    return this.prisma.note.create({
      data: {
        organizationId,
        authorUserId,
        ...dto,
      },
    });
  }

  findAll(organizationId: string, relatedEntityId?: string) {
    return this.prisma.note.findMany({
      where: { organizationId, relatedEntityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const note = await this.prisma.note.findFirst({ where: { id, organizationId } });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }
}
