import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { configureOpenApi } from '../../src/openapi/configure-openapi';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);
  configureOpenApi(app);
  await app.init();
  return app;
}
