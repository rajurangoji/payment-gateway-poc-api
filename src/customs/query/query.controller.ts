import { Controller, Get, Logger, Param } from '@nestjs/common';

import { QueryService } from './query.service';

@Controller('customs')
export class QueryController {
  private readonly logger = new Logger(QueryController.name);
  constructor(private readonly queryService: QueryService) {}

  @Get()
  async findAll(): Promise<string[]> {
    this.logger.log('finding all customs');
    return this.queryService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<string> {
    this.logger.log(`finding a custom with ID ${id}`);
    return this.queryService.findOne(id);
  }
}
