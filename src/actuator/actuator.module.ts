import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { DataModule } from '../data.module';

import { ActuatorController } from './actuator.controller';

@Module({
  imports: [TerminusModule, DataModule],
  controllers: [ActuatorController],
})
export class ActuatorModule {}
