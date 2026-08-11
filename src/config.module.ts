import * as path from 'path';

import { Global, Module } from '@nestjs/common';
import { TypeConfigModule } from '@snow-tzu/type-config-nestjs';

import { AwsSharedConfig } from '@shared/config/aws.shared.config';
import { DatabaseConnectionsConfig } from '@shared/database/providers/database.connnection.config';
import { AppConfig, LoggingConfig } from '@shared/logging/config';
import { SnsConfig } from '@shared/sns/sns.config';
import { SqsConfig } from '@shared/sqs/sqs.config';

import { SampleClientConfig } from './clients/sample/sample.client.config';
import { ExampleQueueConfig } from './examples/example.queue.config';

@Module({
  imports: [
    TypeConfigModule.forRoot({
      profile: process.env.NODE_ENV ?? 'development',
      isGlobal: true,
      configDir: path.join(__dirname, '..', 'resources'),
      validateOnBind: true,
    }),
    TypeConfigModule.forFeature([
      LoggingConfig,
      AppConfig,
      DatabaseConnectionsConfig,
      SampleClientConfig,
      AwsSharedConfig,
      SqsConfig,
      SnsConfig,
      ExampleQueueConfig,
    ]),
  ],
  exports: [TypeConfigModule],
})
@Global()
export class AppConfigModule {}
