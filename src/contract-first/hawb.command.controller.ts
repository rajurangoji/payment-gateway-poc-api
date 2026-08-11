import { Controller, NotImplementedException } from '@nestjs/common';

import { HawbCommandControllerBase } from '@generated/hawb.command/hawb.command.controller.base';
import {
  CreateHawbRequestDto,
  HawbCreatedResponseDto,
  HawbDuplicateResponseDto,
} from '@generated/hawb.command/hawb.command.dto';

@Controller()
export class HawbCommandController extends HawbCommandControllerBase {
  createHawb(
    _body: CreateHawbRequestDto,
    _xSpanId?: string,
    _xTraceId?: string,
  ): Promise<HawbDuplicateResponseDto | HawbCreatedResponseDto> {
    throw new NotImplementedException('Method not implemented.');
  }
}
