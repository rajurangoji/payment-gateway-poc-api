import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';

import { TENANT_CONFIG_PROVIDER } from '@shared/database/interfaces/tenant-config-provider';
import { DatabaseConnectionsConfig } from '@shared/database/providers/database.connnection.config';
import { EnvTenantConfigProvider } from '@shared/database/providers/env-tenant-config.provider';
import { CustomExceptionFilter } from '@shared/filters/custom.exception.filter';

@Global()
@Module({
  imports: [ConfigModule.forRoot()],
  providers: [
    {
      provide: TENANT_CONFIG_PROVIDER,
      useFactory: (
        databaseConnectionsConfig: DatabaseConnectionsConfig,
      ): EnvTenantConfigProvider =>
        new EnvTenantConfigProvider(databaseConnectionsConfig),
      inject: [DatabaseConnectionsConfig],
    },
    {
      provide: APP_FILTER,
      useClass: CustomExceptionFilter,
    },
  ],
  exports: [TENANT_CONFIG_PROVIDER],
})
export class SharedModule {}
