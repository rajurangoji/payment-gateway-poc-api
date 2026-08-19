import { Injectable } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';

import {
  CartProduct,
  Order,
  OrderItem,
  Payment,
  PaymentEvent,
  PaymentTransaction,
  Refund,
  User,
} from '../entities';

@Injectable()
export class PaymentsDataSourceProvider {
  private dataSource?: DataSource;

  buildOptions(): DataSourceOptions {
    return {
      type: 'postgres',
      host: process.env.DB_BU1_US_HOST,
      port: Number(process.env.DB_BU1_US_PORT),
      username: process.env.DB_BU1_US_USERNAME,
      password: process.env.DB_BU1_US_PASSWORD,
      database: process.env.DB_BU1_US_DATABASE,
      schema: process.env.DB_BU1_US_SCHEMA,
      entities: [
        User,
        CartProduct,
        Order,
        OrderItem,
        Payment,
        PaymentTransaction,
        Refund,
        PaymentEvent,
      ],
      synchronize: false,
      logging: false,
    };
  }

  async getDataSource(): Promise<DataSource> {
    if (!this.dataSource) {
      this.dataSource = new DataSource(this.buildOptions());
      await this.dataSource.initialize();
    }
    return this.dataSource;
  }
}
