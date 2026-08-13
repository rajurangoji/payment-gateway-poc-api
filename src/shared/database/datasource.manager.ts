import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntitySchema, MixedList } from 'typeorm';

import { DatabaseConfig } from './interfaces/tenant-config';
import {
  ITenantConfigProvider,
  TENANT_CONFIG_PROVIDER,
} from './interfaces/tenant-config-provider';

@Injectable()
export class DatasourceManager {
  private readonly logger = new Logger(DatasourceManager.name);
  private dataSources = new Map<string, DataSource>();

  constructor(
    @Inject(TENANT_CONFIG_PROVIDER)
    private readonly tenantConfigProvider: ITenantConfigProvider,
    // eslint-disable-next-line @typescript-eslint/ban-types
    private readonly entities: MixedList<Function | string | EntitySchema>,
  ) {
    this.logger.log('DatasourceManager initialized');
  }

  async getDataSource(
    businessUnit: string,
    countryCode: string,
  ): Promise<DataSource> {
    const key = this.keyFrom(businessUnit, countryCode);
    if (!this.dataSources.has(key)) {
      const dataSource = await this.dataSourceFrom(businessUnit, countryCode);
      this.dataSources.set(key, dataSource);
    }

    const dataSource = this.dataSources.get(key);
    if (!dataSource) {
      throw new Error(`DataSource not found for key: ${key}`);
    }
    return dataSource;
  }

  async getDataSources(): Promise<Array<DataSource>> {
    const configs = await this.tenantConfigProvider.getAllConfigs();
    return Array.from(configs).map((config) => this.dataSourceOf(config));
  }

  private keyFrom(businessUnit: string, countryCode: string): string {
    return `${businessUnit}-${countryCode}`.toLowerCase();
  }

  private async dataSourceFrom(
    businessUnit: string,
    countryCode: string,
  ): Promise<DataSource> {
    const config = await this.tenantConfigProvider.getConfigFor(
      businessUnit,
      countryCode,
    );

    const dataSource = this.dataSourceOf(config);

    try {
      await dataSource.initialize();
      this.logger.log(
        `DataSource initialized for business unit: ${businessUnit}, country code: ${countryCode}`,
      );
      return dataSource;
    } catch (error) {
      this.logger.error(
        `Failed to initialize DataSource for business unit: ${businessUnit}, country code: ${countryCode}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  private dataSourceOf(config: DatabaseConfig): DataSource {
    return new DataSource({
      type: 'postgres',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      schema: config.schema,
      entities: this.entities,
      migrations: ['dist/src/migrations/*.js'],
      synchronize: false,
      logging: false,
      poolSize: config.connectionPoolConfig?.max,
      extra: {
        idleTimeoutMillis: config.connectionPoolConfig?.idleTimeoutMillis,
      },
    });
  }
}
