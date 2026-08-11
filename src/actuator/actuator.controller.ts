import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { DatasourceManager } from '@shared/database/datasource.manager';

@Controller('actuator')
export class ActuatorController {
  private readonly startTime: string;

  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private datasourceManager: DatasourceManager,
  ) {
    this.startTime = new Date().toISOString();
  }

  @Get('health')
  @HealthCheck()
  async healthCheck(): Promise<HealthCheckResult> {
    const dataSources = await this.datasourceManager.getDataSources();
    const checks = dataSources.map((dataSource) => async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }
      const options = dataSource.options as PostgresConnectionOptions;
      return this.db.pingCheck(this.getDBName(options), {
        connection: dataSource,
      });
    });
    return this.health.check(checks);
  }

  @Get('liveness')
  async liveness(): Promise<{ status: string }> {
    return { status: 'alive' };
  }

  @Get('readiness')
  async readiness(): Promise<{
    status: string;
    details: Record<string, string>;
  }> {
    const dataSources = await this.datasourceManager.getDataSources();
    const readinessDetails: Record<string, string> = {};
    let allReady = true;
    for (const dataSource of dataSources) {
      const options = dataSource.options as PostgresConnectionOptions;
      try {
        if (!dataSource.isInitialized) {
          await dataSource.initialize();
        }
        await dataSource.query('SELECT 1');
        readinessDetails[this.getDBName(options)] = 'ready';
      } catch (err) {
        readinessDetails[this.getDBName(options)] = 'not connected';
        allReady = false;
      }
    }
    if (allReady) {
      return { status: 'ready', details: readinessDetails };
    } else {
      return { status: 'not ready', details: readinessDetails };
    }
  }

  private getDBName(options: PostgresConnectionOptions): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return `${options.database!}:${options.schema!}`;
  }

  @Get('info')
  async info(): Promise<{ startTime: string; commit: string }> {
    const commit = process.env.COMMIT_HASH ?? 'unknown';
    return {
      startTime: this.startTime,
      commit,
    };
  }
}
