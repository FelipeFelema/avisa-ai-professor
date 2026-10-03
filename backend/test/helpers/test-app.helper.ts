import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { configureOpenApi } from '../../src/openapi/configure-openapi';
import { PrismaService } from '../../src/prisma/prisma.service';
import { assertSafeTestDatabase } from './test-database.helper';

export type TestAppOptions = {
  prismaFactory?: () => PrismaService;
  configureBuilder?: (builder: TestingModuleBuilder) => void;
};

export async function createTestApp(
  options: TestAppOptions = {},
): Promise<INestApplication> {
  assertSafeTestDatabase();

  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.prismaFactory) {
    builder
      .overrideProvider(PrismaService)
      .useFactory({ factory: options.prismaFactory });
  }
  options.configureBuilder?.(builder);

  const moduleFixture: TestingModule = await builder.compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);
  configureOpenApi(app);
  await app.init();
  return app;
}
