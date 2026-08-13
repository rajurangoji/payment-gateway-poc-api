import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';

import { FlightsController } from './flights.controller';
import { HawbCommandController } from './hawb.command.controller';

@Module({
  imports: [PaymentsModule],
  controllers: [HawbCommandController, FlightsController],
  providers: [],
})
export class ContractFirstModule {}
