import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './helpers/test-app.helper';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('replaces the unversioned placeholder route', () => {
    return request(app.getHttpServer()).get('/api').expect(404);
  });

  it('serves the interactive reference and JSON outside production', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/docs')
      .expect(200)
      .expect('Content-Type', /html/);
    await request(app.getHttpServer())
      .get('/api/v1/docs/openapi.json')
      .expect(200)
      .expect('Content-Type', /json/);
  });

  it('denies the OpenAPI reference in production even with the override enabled', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDocsFlag = process.env.API_DOCS_ENABLED;

    await app.close();
    process.env.NODE_ENV = 'production';
    process.env.API_DOCS_ENABLED = 'true';

    try {
      app = (await createTestApp()) as INestApplication<App>;

      await request(app.getHttpServer()).get('/api/v1/docs').expect(404);
      await request(app.getHttpServer())
        .get('/api/v1/docs/openapi.json')
        .expect(404);
    } finally {
      await app.close();
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousDocsFlag === undefined) {
        delete process.env.API_DOCS_ENABLED;
      } else {
        process.env.API_DOCS_ENABLED = previousDocsFlag;
      }
      app = (await createTestApp()) as INestApplication<App>;
    }
  });

  it('denies the OpenAPI reference when NODE_ENV is missing', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDocsFlag = process.env.API_DOCS_ENABLED;

    await app.close();
    delete process.env.NODE_ENV;
    process.env.API_DOCS_ENABLED = 'true';

    try {
      app = (await createTestApp()) as INestApplication<App>;

      await request(app.getHttpServer()).get('/api/v1/docs').expect(404);
      await request(app.getHttpServer())
        .get('/api/v1/docs/openapi.json')
        .expect(404);
    } finally {
      await app.close();
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousDocsFlag === undefined) delete process.env.API_DOCS_ENABLED;
      else process.env.API_DOCS_ENABLED = previousDocsFlag;
      app = (await createTestApp()) as INestApplication<App>;
    }
  });

  it('denies the OpenAPI reference for an unknown NODE_ENV', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDocsFlag = process.env.API_DOCS_ENABLED;

    await app.close();
    process.env.NODE_ENV = 'staging';
    process.env.API_DOCS_ENABLED = 'true';

    try {
      app = (await createTestApp()) as INestApplication<App>;

      await request(app.getHttpServer()).get('/api/v1/docs').expect(404);
      await request(app.getHttpServer())
        .get('/api/v1/docs/openapi.json')
        .expect(404);
    } finally {
      await app.close();
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousDocsFlag === undefined) delete process.env.API_DOCS_ENABLED;
      else process.env.API_DOCS_ENABLED = previousDocsFlag;
      app = (await createTestApp()) as INestApplication<App>;
    }
  });

  it('respects the documentation kill switch outside production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDocsFlag = process.env.API_DOCS_ENABLED;

    await app.close();
    process.env.NODE_ENV = 'test';
    process.env.API_DOCS_ENABLED = 'false';

    try {
      app = (await createTestApp()) as INestApplication<App>;

      await request(app.getHttpServer()).get('/api/v1/docs').expect(404);
      await request(app.getHttpServer())
        .get('/api/v1/docs/openapi.json')
        .expect(404);
    } finally {
      await app.close();
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousDocsFlag === undefined) {
        delete process.env.API_DOCS_ENABLED;
      } else {
        process.env.API_DOCS_ENABLED = previousDocsFlag;
      }
      app = (await createTestApp()) as INestApplication<App>;
    }
  });
});
