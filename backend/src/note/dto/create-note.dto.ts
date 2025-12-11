import { IsString } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  relatedEntityType!: string;

  @IsString()
  relatedEntityId!: string;

  @IsString()
  body!: string;
}
