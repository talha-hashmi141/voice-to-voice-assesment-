import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { TicketRepository } from './ticket.repository';
import { HttpTicketingClient, InProcessTicketingClient } from './ticketing-client.adapters';
import { TICKETING_CLIENT, type TicketingClient } from './ticketing-client.port';

@Module({
  controllers: [HrController],
  providers: [
    HrService,
    TicketRepository,
    {
      provide: TICKETING_CLIENT,
      inject: [AppConfigService, TicketRepository],
      useFactory: (config: AppConfigService, tickets: TicketRepository): TicketingClient =>
        config.ticketingApiUrl === 'inprocess'
          ? new InProcessTicketingClient(tickets)
          : new HttpTicketingClient(config.ticketingApiUrl),
    },
  ],
  exports: [HrService, TicketRepository, TICKETING_CLIENT],
})
export class HrModule {}
