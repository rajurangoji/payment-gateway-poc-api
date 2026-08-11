import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { SnsMessagePublisher } from '@snow-tzu/aws-message-publisher';

import { Propagation, TenantRequest } from '@shared';
import { DatasourceManager } from '@shared/database/datasource.manager';
import { TransactionContext } from '@shared/transaction/transaction-context';
import { Transactional } from '@shared/transaction/transactional-method.decorator';

import { CUSTOM_MESSAGE_PUBLISHER } from '../../constants/tokens';
import { SampleEvent } from '../../events/sample.event';

import { Message } from './message.entity';

@Injectable({ scope: Scope.REQUEST })
export class QueryService extends TransactionContext {
  private readonly logger = new Logger(QueryService.name);

  // mandatory to inject request to have request scope and
  // data source manager for annotation to work
  constructor(
    @Inject(REQUEST) private readonly request: TenantRequest,
    private readonly datasourceManager: DatasourceManager,
    @Inject(CUSTOM_MESSAGE_PUBLISHER)
    private readonly customsPublisher: SnsMessagePublisher<SampleEvent>,
  ) {
    super();
  }

  async findAll(): Promise<string[]> {
    this.logger.log('find all customs');
    const results = await this.findAllInTransaction();
    await this.customsPublisher.publish(
      {
        type: 'CustomsListFetched',
        at: new Date().toISOString(),
        count: results.length,
      },
      {
        messageAttributes: {
          domain: {
            dataType: 'String',
            value: 'Customs',
          },
        },
      },
    );
    this.logger.log('published customs list fetched event');
    return results;
  }

  @Transactional()
  private async findAllInTransaction(): Promise<string[]> {
    const messages = await this.entityManager
      .createQueryBuilder(Message, 'm')
      .select('m.message')
      .getRawMany();
    const _ = await this.findAllInSameTransaction();
    return messages.map((row: { m_message: string }) => row.m_message);
  }

  @Transactional()
  private async findAllInSameTransaction(): Promise<string[]> {
    const messages = await this.entityManager
      .createQueryBuilder(Message, 'm')
      .select('m.message')
      .getRawMany();
    return messages.map((row: { m_message: string }) => row.m_message);
  }

  async findOne(id: number): Promise<string> {
    this.logger.log(`Find a custom of id ${id}`);
    const result = await this.findOneInTransaction(id);
    await this.customsPublisher.publish(
      {
        type: 'CustomsFetched',
        id: id.toString(),
        at: new Date().toISOString(),
      },
      {
        messageAttributes: {
          domain: {
            dataType: 'String',
            value: 'Customs',
          },
        },
      },
    );
    this.logger.log(`published custom fetched event for id ${id}`);
    return result;
  }
  @Transactional()
  private async findOneInTransaction(id: number): Promise<string> {
    const message = await this.entityManager
      .query('SELECT * FROM messages WHERE id = $1', [id])
      .then((res: Message[]) => res[0]);
    if (!message) {
      throw new Error(`Message with id ${id} not found`);
    }
    const _ = await this.findOneInDifferentTransaction(id);
    return message.message;
  }

  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  private async findOneInDifferentTransaction(id: number): Promise<string> {
    const message = await this.entityManager
      .query('SELECT * FROM messages WHERE id = $1', [id])
      .then((res: Message[]) => res[0]);
    if (!message) {
      throw new Error(`Message with id ${id} not found`);
    }
    return message.message;
  }
}
