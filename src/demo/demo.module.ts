import { Module } from '@nestjs/common';

import { SampleClientModule } from '../clients/sample/sampleClientModule';

import { DemoController } from './demo.controller';

@Module({
  imports: [SampleClientModule],
  controllers: [DemoController],
})
export class DemoModule {}
