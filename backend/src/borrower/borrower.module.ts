import { Module } from '@nestjs/common';
import { BorrowerService } from './borrower.service';
import { BorrowerController } from './borrower.controller';

@Module({
  providers: [BorrowerService],
  controllers: [BorrowerController],
  exports: [BorrowerService],
})
export class BorrowerModule {}
