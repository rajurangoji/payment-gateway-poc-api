import { Injectable } from '@nestjs/common';

import { DatabaseConnectionsConfig } from '@shared/database/providers/database.connnection.config';

import { DatabaseConfig } from '../interfaces/tenant-config';
import { ITenantConfigProvider } from '../interfaces/tenant-config-provider';

@Injectable()
export class EnvTenantConfigProvider implements ITenantConfigProvider {
  constructor(
    private readonly databaseConnectionsConfig: DatabaseConnectionsConfig,
  ) {}

  getConfigFor(
    businessUnit: string,
    countryCode: string,
  ): Promise<DatabaseConfig> {
    const key = this.buildKey(businessUnit, countryCode);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const dbConfig = this.databaseConnectionsConfig.getConnection(key);
    if (!dbConfig) {
      return Promise.reject(
        new Error(`No database config found for key: ${key}`),
      );
    }
    return Promise.resolve(dbConfig);
  }

  getAllConfigs(): Promise<DatabaseConfig[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const dbConfigs = this.databaseConnectionsConfig.getConnections();
    if (!dbConfigs) {
      return Promise.reject(new Error('No database configs found'));
    }
    return Promise.resolve(dbConfigs);
  }

  refresh?(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private buildKey(businessUnit: string, countryCode: string): string {
    return `${businessUnit.toLowerCase()}-${countryCode.toLowerCase()}`;
  }
}
