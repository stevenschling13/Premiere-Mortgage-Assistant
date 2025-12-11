import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { CreateWebhookSubscriptionDto } from './dto/create-webhook-subscription.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, TenantGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('subscriptions')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateWebhookSubscriptionDto) {
    return this.webhookService.create(user.organizationId, body);
  }

  @Get('subscriptions')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.webhookService.findAll(user.organizationId);
  }

  @Delete('subscriptions/:id')
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.webhookService.deactivate(user.organizationId, id);
  }
}
