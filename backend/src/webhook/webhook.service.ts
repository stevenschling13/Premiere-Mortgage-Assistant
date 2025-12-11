import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookSubscriptionDto } from './dto/create-webhook-subscription.dto';

@Injectable()
export class WebhookService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, dto: CreateWebhookSubscriptionDto) {
    return this.prisma.webhookSubscription.create({
      data: { ...dto, organizationId, isActive: dto.isActive ?? true },
    });
  }

  findAll(organizationId: string) {
    return this.prisma.webhookSubscription.findMany({ where: { organizationId } });
  }

  async deactivate(organizationId: string, id: string) {
    await this.ensureSubscription(organizationId, id);
    return this.prisma.webhookSubscription.update({ where: { id }, data: { isActive: false } });
  }

  private async ensureSubscription(organizationId: string, id: string) {
    const sub = await this.prisma.webhookSubscription.findFirst({ where: { id, organizationId } });
    if (!sub) {
      throw new NotFoundException('Webhook subscription not found');
    }
    return sub;
  }
}
