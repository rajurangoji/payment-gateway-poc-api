import { Controller } from '@nestjs/common';

import { FlightsControllerBase } from '@generated/flights/flights.controller.base';
import {
  FlightCreatedResponseDto,
  FlightUpdatedResponseDto,
  UpsertFlightRequestDto,
} from '@generated/flights/flights.dto';

@Controller()
export class FlightsController extends FlightsControllerBase {
  upsertFlight(
    _body: UpsertFlightRequestDto,
    _country_code?: string,
    _traceparent?: string,
    _xSpanId?: string,
    _xTraceId?: string,
  ): Promise<FlightUpdatedResponseDto | FlightCreatedResponseDto> {
    throw new Error('Method not implemented.');
  }
}
