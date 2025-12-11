import { Module } from '@nestjs/common';
import { OutboundEventService } from './outbound-event.service';
import { OutboundEventController } from './outbound-event.controller';

@Module({
  providers: [OutboundEventService],
  controllers: [OutboundEventController],
  exports: [OutboundEventService],
})
export class OutboundEventModule {}
