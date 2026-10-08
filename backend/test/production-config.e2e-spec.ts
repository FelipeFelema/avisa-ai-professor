import { randomBytes } from 'node:crypto';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { configureApp } from '../src/configure-app';
import { configureOpenApi } from '../src/openapi/configure-openapi';

@Controller({ version: '1' })
class FaultController {
  @Get('release-fault')
  fault(): never {
    throw new Error('PRIVATE-STARTUP-SENTINEL');
  }
}

describe('production configuration and HTTP privacy', () => {
  let previous: NodeJS.ProcessEnv;
  let app: INestApplication;
  beforeEach(async () => {
    previous = { ...process.env };
    delete process.env.TRUST_PROXY_CIDRS;
    Object.assign(process.env, {
      DATABASE_URL: `postgresql://fixture:${randomBytes(24).toString('hex')}@localhost:5432/avisa_ai_test`,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
      JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
      CORS_ORIGIN: 'https://app.example.com',
      EXPO_PUSH_ENABLED: 'false',
      ANNOUNCEMENT_PUSH_ENABLED: 'false',
      ANNOUNCEMENT_PUSH_REMINDERS_ENABLED: 'false',
      API_DOCS_ENABLED: 'true',
    });
    const module = await Test.createTestingModule({
      controllers: [AppController, FaultController],
      providers: [AppService],
    }).compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
  });
  afterEach(async () => {
    await app.close();
    process.env = previous;
  });

  it.each([
    ['JWT_ACCESS_SECRET', ''],
    ['JWT_REFRESH_SECRET', 'replace_with_a_strong_refresh_secret'],
    ['CORS_ORIGIN', '*'],
    ['CORS_ORIGIN', 'http://localhost:3000'],
    ['CORS_ORIGIN', 'https://app.example.com/path'],
    ['PORT', '0'],
    ['EXPO_PUSH_ENABLED', 'yes'],
    ['DATABASE_URL', 'not-a-database'],
    ['TRUST_PROXY_CIDRS', 'true'],
    ['TRUST_PROXY_CIDRS', '::ffff:0.0.0.0/96'],
  ])(
    'fails before serving invalid %s without echoing its value',
    (key, value) => {
      process.env[key] = value;
      expect(() => configureApp(app)).toThrow(/^PRODUCTION_CONFIG_INVALID:/);
    },
  );
  it('rejects reused JWT secrets and enabled push without provider credential', () => {
    process.env.JWT_REFRESH_SECRET = process.env.JWT_ACCESS_SECRET;
    expect(() => configureApp(app)).toThrow('JWT_SECRETS_DISTINCT');
    process.env.JWT_REFRESH_SECRET = randomBytes(32).toString('hex');
    process.env.EXPO_PUSH_ENABLED = 'true';
    delete process.env.EXPO_PUSH_ACCESS_TOKEN;
    expect(() => configureApp(app)).toThrow('EXPO_PUSH_ACCESS_TOKEN');
  });
  it('serves minimal health, suppresses docs including JSON, sanitizes faults and enforces CORS', async () => {
    configureApp(app);
    configureOpenApi(app);
    await app.init();
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
    for (const path of [
      '/api/docs',
      '/api/docs-json',
      '/api/docs-yaml',
      '/api/v1/docs',
      '/api/v1/docs-json',
    ]) {
      await request(server).get(path).expect(404);
    }
    const fault = await request(server)
      .get('/api/v1/release-fault')
      .expect(500);
    expect(JSON.stringify(fault.body)).not.toMatch(/PRIVATE|stack|Prisma|SQL/);
    const allowed = await request(server)
      .get('/api/v1/health')
      .set('Origin', 'https://app.example.com');
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'https://app.example.com',
    );
    const denied = await request(server)
      .get('/api/v1/health')
      .set('Origin', 'https://attacker.example.com');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    const express = app.getHttpAdapter().getInstance() as {
      get(key: string): unknown;
    };
    expect(express.get('trust proxy')).toBe(false);
  });
});
