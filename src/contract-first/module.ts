import { Module } from '@nestjs/common';

import { FlightsController } from './flights.controller';
import { HawbCommandController } from './hawb.command.controller';

@Module({
  imports: [],
  controllers: [HawbCommandController, FlightsController],
  providers: [],
})
export class ContractFirstModule {}
