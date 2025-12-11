import { Controller, Get, UseGuards } from '@nestjs/common';
import { OutboundEventService } from './outbound-event.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@Controller('outbound-events')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OutboundEventController {
  constructor(private readonly outboundService: OutboundEventService) {}

  @Get('pending')
  findPending() {
    return this.outboundService.findPending();
  }
}
