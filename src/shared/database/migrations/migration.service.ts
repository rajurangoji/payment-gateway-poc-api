import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { DatasourceManager } from '../datasource.manager';

@Injectable()
export class MigrationService {
  constructor(
    private readonly datasourceManager: DatasourceManager,
    @InjectPinoLogger(MigrationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async runMigrationsOnAllTenantDatabases(): Promise<void> {
    const dataSources = await this.datasourceManager.getDataSources();
    this.logger.info(
      `Running migrations on ${dataSources.length} tenant database(s)`,
    );
    for (const dataSource of dataSources) {
      await this.runMigrationsOnDatabase(dataSource);
    }
  }

  private async runMigrationsOnDatabase(dataSource: DataSource): Promise<void> {
    const options = dataSource.options as PostgresConnectionOptions;
    const lockKey = this.generateLockKey(
      options.database ?? '',
      options.schema,
    );
    try {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }
      await this.setSchema(dataSource, options.schema);
      this.logPendingMigrations(dataSource, options);
      const lockAcquired = await this.acquireAdvisoryLock(
        dataSource,
        lockKey,
        options,
      );
      if (!lockAcquired) {
        return;
      }
      this.logger.info(
        `Acquired advisory lock. Running migrations on database: ${options.database} (schema: ${options.schema})`,
      );
      const migrationResult = await dataSource.runMigrations();
      this.logAppliedMigrations(migrationResult, options);
      this.logger.info(
        `Migrations completed on database: ${dataSource.options.database} (schema: ${options.schema})`,
      );
    } catch (error) {
      this.logger.error(
        `Migration failed on database: ${dataSource.options.database} (schema: ${options.schema})`,
        error,
      );
      throw error;
    } finally {
      await this.releaseAdvisoryLock(dataSource, lockKey, options);
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  }

  private async setSchema(
    dataSource: DataSource,
    schema?: string,
  ): Promise<void> {
    await dataSource.query(`SET search_path TO ${schema}`);
  }

  private logPendingMigrations(
    dataSource: DataSource,
    options: PostgresConnectionOptions,
  ): void {
    const pendingMigrations = dataSource.migrations?.map((m) => m.name) ?? [];
    this.logger.info({
      msg: `Pending migrations for database: ${options.database} (schema: ${options.schema})`,
      migrations: pendingMigrations,
    });
  }

  private logAppliedMigrations(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migrationResult: any[],
    options: PostgresConnectionOptions,
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    const appliedMigrations = migrationResult?.map((m) => m.name) ?? [];
    this.logger.info({
      msg: `Applied migrations for database: ${options.database} (schema: ${options.schema})`,
      migrations: appliedMigrations,
    });
  }

  private async acquireAdvisoryLock(
    dataSource: DataSource,
    lockKey: number,
    options: PostgresConnectionOptions,
  ): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const lockAcquired = await dataSource.query(
      `SELECT pg_try_advisory_lock(${lockKey}) as locked`,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!lockAcquired[0]?.locked) {
      this.logger.warn(
        `Could not acquire advisory lock for database: ${options.database} (schema: ${options.schema}), skipping migration.`,
      );
      return false;
    }
    return true;
  }

  private async releaseAdvisoryLock(
    dataSource: DataSource,
    lockKey: number,
    options: PostgresConnectionOptions,
  ): Promise<void> {
    try {
      await dataSource.query(`SELECT pg_advisory_unlock(${lockKey})`);
      this.logger.info(
        `Released advisory lock for database: ${options.database} (schema: ${options.schema})`,
      );
    } catch (unlockError) {
      this.logger.warn(
        `Failed to release advisory lock for database: ${options.database} (schema: ${options.schema})`,
        unlockError,
      );
    }
  }

  private generateLockKey(database: string, schema?: string): number {
    const str = `${database}:${schema ?? ''}`;
    let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash;
  }
}
