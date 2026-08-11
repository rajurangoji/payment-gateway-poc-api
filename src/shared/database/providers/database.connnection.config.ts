import {
  ConfigProperty,
  ConfigurationProperties,
  RecordType,
} from '@snow-tzu/type-config-nestjs';

import { DatabaseConfig } from '@shared/database/interfaces/tenant-config';

export class DatabaseConnection {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
  pool: PoolConfig;
  isActive: boolean;
}

export class PoolConfig {
  maxConnections: number;
  minConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

@ConfigurationProperties('databases')
export class DatabaseConnectionsConfig {
  @ConfigProperty('connections')
  @RecordType()
  databaseConnections: Record<string, DatabaseConnection>;

  @ConfigProperty('pool')
  pool: PoolConfig;

  private filledPoolConnections(): Record<string, DatabaseConnection> {
    for (const connection of Object.values(this.databaseConnections)) {
      if (!connection.pool) {
        connection.pool = this.pool;
      }
      if (connection.isActive === undefined) {
        connection.isActive = true;
      }
    }
    return this.databaseConnections;
  }

  public getConnections(): DatabaseConfig[] {
    const connections = this.filledPoolConnections();
    return Object.entries(connections).map(([_name, config]) =>
      this.mapTo(config),
    );
  }

  public getConnection(key: string): DatabaseConfig | undefined {
    const connections = this.filledPoolConnections();
    const config = connections[key];
    if (!config) {
      return undefined;
    }
    return this.mapTo(config);
  }

  private mapTo(config: DatabaseConnection): DatabaseConfig {
    return {
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      schema: config.schema,
      connectionPoolConfig: {
        min: config.pool.minConnections,
        max: config.pool.maxConnections,
        idleTimeoutMillis: config.pool.idleTimeoutMillis,
        connectionTimeoutMillis: config.pool.connectionTimeoutMillis,
      },
      isActive: config.isActive,
    };
  }
}
