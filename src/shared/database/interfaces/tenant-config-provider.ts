import { DatabaseConfig } from './tenant-config';

export interface ITenantConfigProvider {
  getConfigFor(
    businessUnit: string,
    countryCode: string,
  ): Promise<DatabaseConfig>;
  getAllConfigs(): Promise<DatabaseConfig[]>;
  refresh?(): Promise<void>;
}

export const TENANT_CONFIG_PROVIDER = Symbol('ITenantConfigProvider');
