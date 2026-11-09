import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { TicketRepository } from './ticket.repository';

@Module({
  controllers: [HrController],
  providers: [HrService, TicketRepository],
  exports: [HrService, TicketRepository],
})
export class HrModule {}
