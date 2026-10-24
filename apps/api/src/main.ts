import './instrument';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { fatalExit } from './common/fatal-exit';
import { AppConfig } from './config/config';
import { APP_CONFIG } from './config/config.module';
import { MigrationRunner } from './database/migration-runner';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // HTTP apps otherwise flush buffered logs only at init(), which a failed migration never reaches.
  app.flushLogs();
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  const config = app.get<AppConfig>(APP_CONFIG);

  // Migrate before accepting traffic; replicas serialise on an advisory lock.
  await app.get(MigrationRunner).run();

  app.setGlobalPrefix('v1', { exclude: ['healthz', 'readyz'] });

  const openApi = cleanupOpenApiDoc(
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Weekly Planner API').setVersion('1').addBearerAuth().build(),
    ),
  );
  SwaggerModule.setup('v1/docs', app, openApi, {
    jsonDocumentUrl: 'v1/openapi.json',
    swaggerUiEnabled: config.NODE_ENV === 'development',
  });

  await app.listen(config.API_PORT, '0.0.0.0');
  app.get(Logger).log(`API listening on port ${config.API_PORT}`);
}

bootstrap().catch((err: unknown) => fatalExit('API bootstrap', err));
