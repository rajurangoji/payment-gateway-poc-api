import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';

import { MigrationService } from '@shared/database/migrations/migration.service';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const configService = app.get(ConfigService);

  const logger = app.get(Logger);
  app.enableShutdownHooks();
  app.useLogger(logger);
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  const migrationService = app.get(MigrationService);
  await migrationService.runMigrationsOnAllTenantDatabases();

  const port =
    process.env.PORT ?? configService.get<number>('config.app.port') ?? 3000;
  const swaggerEnabled =
    configService.get<boolean>('config.app.swaggerEnabled') ?? true;

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Catalyst')
      .setDescription('The Catalyst API description')
      .setVersion('1.0')
      .addTag('Customs', 'Customs related endpoints')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log(`API documentation available at http://localhost:${port}/docs`);
  }

  await app.listen(port);

  process.on('SIGINT', async () => {
    logger.log('Received SIGINT, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.log('Received SIGTERM, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
  logger.log(`Application is running on: http://localhost:${port}`);
}

process.on('uncaughtException', (error) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Error during application bootstrap:', error);
  process.exit(1);
});
