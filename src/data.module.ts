import { Global, Module } from '@nestjs/common';

import { DatasourceManager } from '@shared/database/datasource.manager';
import {
  ITenantConfigProvider,
  TENANT_CONFIG_PROVIDER,
} from '@shared/database/interfaces/tenant-config-provider';

import { Message } from './customs/query/message.entity';
import {
  CartProduct,
  Order,
  OrderItem,
  Payment,
  PaymentEvent,
  PaymentTransaction,
  Refund,
  User,
} from './payments/entities';
import { SharedModule } from './shared.module';

@Global()
@Module({
  imports: [SharedModule],
  providers: [
    {
      provide: DatasourceManager,
      useFactory: (
        tenantConfigProvider: ITenantConfigProvider,
      ): DatasourceManager =>
        new DatasourceManager(tenantConfigProvider, [
          Message,
          User,
          CartProduct,
          Order,
          OrderItem,
          Payment,
          PaymentTransaction,
          Refund,
          PaymentEvent,
        ]),
      inject: [TENANT_CONFIG_PROVIDER],
    },
  ],
  exports: [DatasourceManager],
})
export class DataModule {}
