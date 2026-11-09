import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { AppConfigService, HttpExceptionFilter } from './common';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get(AppConfigService);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const openapi = new DocumentBuilder()
    .setTitle('Voice RAG Agent API')
    .setDescription('Voice gateway, agent runtime, hybrid retrieval and tools')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(SwaggerModule.createDocument(app, openapi)));

  await app.listen(config.port);
  logger.log(`API listening on http://localhost:${config.port}/api (provider: ${config.aiProvider})`);
}

void bootstrap();
