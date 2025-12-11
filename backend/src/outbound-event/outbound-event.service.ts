import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OutboundEventStatus } from '../common/prisma-enums';
import { createHmac } from 'crypto';

@Injectable()
export class OutboundEventService {
  constructor(private readonly prisma: PrismaService) {}

  enqueue(organizationId: string, eventType: string, payload: Record<string, unknown>) {
    return this.prisma.outboundEvent.create({
      data: {
        organizationId,
        eventType,
        payload,
        status: OutboundEventStatus.PENDING,
        retryCount: 0,
      },
    });
  }

  findPending(limit = 20) {
    return this.prisma.outboundEvent.findMany({
      where: { status: OutboundEventStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markDelivered(id: string) {
    await this.prisma.outboundEvent.update({ where: { id }, data: { status: OutboundEventStatus.DELIVERED } });
  }

  async markFailed(id: string, error: string) {
    const event = await this.prisma.outboundEvent.findUnique({ where: { id } });
    await this.prisma.outboundEvent.update({
      where: { id },
      data: {
        retryCount: (event?.retryCount ?? 0) + 1,
        lastError: error,
        status: (event?.retryCount ?? 0) + 1 >= 3 ? OutboundEventStatus.FAILED : OutboundEventStatus.PENDING,
      },
    });
  }

  private sign(secret: string, payload: string) {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  async dispatchPending(fetchImpl: typeof fetch = fetch) {
    const events = await this.findPending();
    for (const event of events) {
      const subscriptions = await this.prisma.webhookSubscription.findMany({
        where: { organizationId: event.organizationId, eventType: event.eventType, isActive: true },
      });
      if (!subscriptions.length) {
        await this.markDelivered(event.id);
        continue;
      }
      for (const sub of subscriptions) {
        const body = JSON.stringify({ eventType: event.eventType, payload: event.payload });
        const signature = this.sign(sub.secret, body);
        try {
          const response = await fetchImpl(sub.targetUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-signature': signature,
            },
            body,
          });
          if (!response.ok) {
            await this.markFailed(event.id, `Status ${response.status}`);
          } else {
            await this.markDelivered(event.id);
          }
        } catch (err) {
          await this.markFailed(event.id, (err as Error).message);
        }
      }
    }
  }
}
