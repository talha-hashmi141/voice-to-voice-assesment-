import './test-env';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common';

/** Boots the full application in test mode (mock AI providers, test database). */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  void cleanupOpenApiDoc;
  return app;
}
