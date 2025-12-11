import { IsEnum, IsObject, IsString } from 'class-validator';
import { ConversationChannel } from '../../common/prisma-enums';

export class CreateConversationDto {
  @IsString()
  relatedEntityType!: string;

  @IsString()
  relatedEntityId!: string;

  @IsEnum(ConversationChannel)
  channel!: ConversationChannel;

  @IsObject()
  messages!: Record<string, unknown>[];
}
