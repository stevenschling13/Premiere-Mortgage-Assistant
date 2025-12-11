import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateWebhookSubscriptionDto {
  @IsString()
  eventType!: string;

  @IsUrl()
  targetUrl!: string;

  @IsString()
  secret!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
