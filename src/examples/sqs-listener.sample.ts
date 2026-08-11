import { Injectable, Logger } from '@nestjs/common';
import {
  MessageContext,
  QueueListener,
  SQSMessageAttributes,
} from '@snow-tzu/nest-sqs-listener';
import { QueryRunner } from 'typeorm';

import {
  TENANT_HEADER_BUSINESS_UNIT,
  TENANT_HEADER_BUSINESS_UNIT_ALT,
  TENANT_HEADER_COUNTRY_CODE,
  TENANT_HEADER_COUNTRY_CODE_ALT,
} from '@shared';
import { DatasourceManager } from '@shared/database/datasource.manager';

import { SampleEvent } from '../events/sample.event';

@Injectable()
export class SampleSqsConsumer implements QueueListener<SampleEvent> {
  private readonly logger: Logger = new Logger(SampleSqsConsumer.name);
  constructor(private readonly datatSourceManager: DatasourceManager) {}

  from(attrs: SQSMessageAttributes): {
    businessUnit: string | undefined;
    countryCode: string | undefined;
  } {
    const businessUnit =
      attrs[TENANT_HEADER_BUSINESS_UNIT]?.StringValue ??
      attrs[TENANT_HEADER_BUSINESS_UNIT_ALT]?.StringValue;
    const countryCode =
      attrs[TENANT_HEADER_COUNTRY_CODE]?.StringValue ??
      attrs[TENANT_HEADER_COUNTRY_CODE_ALT]?.StringValue;
    return {
      businessUnit,
      countryCode,
    };
  }

  private async getQueryRunner(
    attrs: SQSMessageAttributes,
  ): Promise<QueryRunner> {
    const { businessUnit, countryCode } = this.from(attrs);
    if (!businessUnit || !countryCode) {
      this.logger.error(
        `Missing tenant context in message attributes: ${JSON.stringify(attrs)}`,
      );
      throw new Error('Missing tenant context');
    }
    const dataSource = await this.datatSourceManager.getDataSource(
      businessUnit,
      countryCode,
    );
    if (!dataSource) {
      this.logger.error(
        `No data source found for businessUnit: ${businessUnit}, countryCode: ${countryCode}`,
      );
      throw new Error('Data source not found');
    }
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`SET search_path TO ${countryCode}`);
    return queryRunner;
  }

  async onMessage(
    payload: SampleEvent,
    context: MessageContext,
  ): Promise<void> {
    this.logger.log(
      `Received ${JSON.stringify(payload)} with attributes ${JSON.stringify(context.getMessageAttributes())}`,
    );
    await this.delay(1000);
    let queryRunner: QueryRunner | undefined;
    try {
      queryRunner = await this.getQueryRunner(context.getMessageAttributes());
      const result: unknown = await queryRunner.query(
        `SELECT * FROM messages WHERE id = $1`,
        [payload.id],
      );
      this.logger.log(`Queried message from DB: ${JSON.stringify(result)}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error querying message: ${errorMsg}`);
      throw error;
    } finally {
      if (queryRunner) {
        await queryRunner.release();
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
