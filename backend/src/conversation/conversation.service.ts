import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, dto: CreateConversationDto) {
    return this.prisma.conversation.create({
      data: {
        organizationId,
        ...dto,
      },
    });
  }

  findAll(organizationId: string, relatedEntityId?: string) {
    return this.prisma.conversation.findMany({ where: { organizationId, relatedEntityId } });
  }

  async findOne(organizationId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id, organizationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }
}
