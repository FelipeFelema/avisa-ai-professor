import {
  BadRequestException,
  Controller,
  INestApplication,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import { configureApp } from '../src/configure-app';
import { SEC013_LOG_LABEL } from '../src/common/middleware/proxy-diagnostics.middleware';

@Controller({ version: '1' })
class ProbeController {
  @Post('auth/login')
  @UseGuards(RateLimitGuard)
  probe() {
    throw new BadRequestException('INVALID_PROBE');
  }
}

describe('SEC-013 instrumentation through real HTTP and limiter', () => {
  let previous: NodeJS.ProcessEnv;
  let app: INestApplication;
  let log: jest.SpyInstance;
  beforeEach(async () => {
    previous = { ...process.env };
    process.env.NODE_ENV = 'test';
    delete process.env.TRUST_PROXY_CIDRS;
    process.env.SEC013_PROXY_DIAGNOSTICS = 'true';
    process.env.SEC013_PROXY_DIAGNOSTICS_HMAC_KEY = '0123456789abcdef'.repeat(
      4,
    );
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const module = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [RateLimitGuard],
    }).compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
  });
  afterEach(async () => {
    await app.close();
    log.mockRestore();
    process.env = previous;
  });
  function records() {
    return log.mock.calls
      .map(([line]: [unknown]) => line)
      .filter(
        (line): line is string =>
          typeof line === 'string' && line.includes(SEC013_LOG_LABEL),
      )
      .map(
        (line) =>
          JSON.parse(line) as {
            limiterKey: { exactKeyFingerprint: string } | null;
            status: number;
            probe: string;
            socket: { fingerprint: string };
          },
      );
  }
  it('observes shared 429 keys without changing default trust or permitting forged headers to rotate the bucket', async () => {
    configureApp(app);
    await app.init();
    expect(
      (
        app.getHttpAdapter().getInstance() as { get: (key: string) => unknown }
      ).get('trust proxy'),
    ).toBe(false);
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    for (let i = 1; i <= 12; i++) {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .set('X-Avisa-Proxy-Probe', i <= 11 ? 'PC' : 'MOBILE')
        .set('X-Forwarded-For', `203.0.113.${i}`)
        .set('CF-Connecting-IP', `198.51.100.${i}`)
        .set('CF-Connecting-IPv6', `2001:db8::${i}`)
        .set('True-Client-IP', `198.51.100.${i}`)
        .set('X-Real-IP', `192.0.2.${i}`)
        .set('Forwarded', `for=198.51.100.${i}`)
        .send({});
      expect(response.status).toBe(i <= 10 ? 400 : 429);
    }
    const result = records();
    expect(result).toHaveLength(12);
    expect(
      new Set(result.map((record) => record.limiterKey?.exactKeyFingerprint))
        .size,
    ).toBe(1);
    expect(result[11].probe).toBe('MOBILE');
    expect(result[11].limiterKey?.exactKeyFingerprint).toBe(
      result[11].socket.fingerprint,
    );
    expect(result[11].status).toBe(429);
  });
  it('keeps disabled instrumentation silent and rejects bad diagnostic config before serving', async () => {
    process.env.SEC013_PROXY_DIAGNOSTICS_HMAC_KEY = 'invalid-private-key';
    expect(() => configureApp(app)).toThrow(
      'SEC013_DIAGNOSTICS_CONFIG_INVALID:HMAC_KEY',
    );
    process.env.SEC013_PROXY_DIAGNOSTICS = 'false';
    configureApp(app);
    await app.init();
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .post('/api/v1/auth/login')
      .set('X-Avisa-Proxy-Probe', 'PC')
      .send({})
      .expect(400);
    expect(records()).toEqual([]);
  });
  it('records no key if JSON parsing stops before the guard, and ignores unmarked login requests', async () => {
    configureApp(app);
    await app.init();
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).post('/api/v1/auth/login').send({}).expect(400);
    expect(records()).toEqual([]);
    await request(server)
      .post('/api/v1/auth/login')
      .set('X-Avisa-Proxy-Probe', 'MOBILE')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(records()).toHaveLength(1);
    expect(records()[0].limiterKey).toBeNull();
  });
});
