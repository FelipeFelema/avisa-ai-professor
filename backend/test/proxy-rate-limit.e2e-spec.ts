import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import { configureApp } from '../src/configure-app';

@Controller({ version: '1' })
class BudgetController {
  @Get('proxy-budget')
  @UseGuards(RateLimitGuard)
  check() {
    return { status: 'ok' };
  }
}

describe('trusted proxies and the real HTTP rate limit', () => {
  let previous: NodeJS.ProcessEnv;
  let app: INestApplication;

  beforeEach(async () => {
    previous = { ...process.env };
    process.env.NODE_ENV = 'test';
    delete process.env.TRUST_PROXY_CIDRS;
    const module = await Test.createTestingModule({
      controllers: [BudgetController],
      providers: [RateLimitGuard],
    }).compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
  });

  afterEach(async () => {
    await app.close();
    process.env = previous;
  });

  async function start(cidrs?: string) {
    if (cidrs !== undefined) process.env.TRUST_PROXY_CIDRS = cidrs;
    configureApp(app);
    await app.init();
  }

  async function hit(forwarded?: string) {
    const call = request(
      app.getHttpServer() as Parameters<typeof request>[0],
    ).get('/api/v1/proxy-budget');
    if (forwarded) call.set('X-Forwarded-For', forwarded);
    // These unrelated headers must never select the rate-limit identity.
    call.set('CF-Connecting-IP', '198.51.100.99');
    call.set('True-Client-IP', '198.51.100.98');
    return call;
  }

  it('ignores forged headers by default and from an untrusted socket', async () => {
    await start('192.0.2.0/24');
    for (let i = 0; i < 10; i++)
      expect((await hit(`203.0.113.${i + 1}`)).status).toBe(200);
    expect((await hit('203.0.113.99')).status).toBe(429);
  });

  it('keeps trust disabled when no allowlist is configured', async () => {
    await start();
    const instance = app.getHttpAdapter().getInstance() as {
      get(key: string): unknown;
    };
    expect(instance.get('trust proxy')).toBe(false);
    for (let i = 0; i < 10; i++)
      expect((await hit(`203.0.113.${i + 1}`)).status).toBe(200);
    expect((await hit('203.0.113.99')).status).toBe(429);
  });

  it('isolates clients behind trusted proxies without accepting a forged prefix', async () => {
    await start('127.0.0.1/32,::1/128,192.0.2.0/24');
    for (let i = 0; i < 10; i++) {
      expect(
        (await hit(`198.51.100.${i + 1},203.0.113.1,192.0.2.10`)).status,
      ).toBe(200);
      expect((await hit('203.0.113.2,192.0.2.11')).status).toBe(200);
    }
    expect((await hit('198.51.100.99,203.0.113.1,192.0.2.12')).status).toBe(
      429,
    );
    expect((await hit('203.0.113.2,192.0.2.10')).status).toBe(429);
    expect((await hit('203.0.113.3,192.0.2.10')).status).toBe(200);
  });

  it('stops at the nearest untrusted hop when the path gets longer', async () => {
    await start('127.0.0.1/32,::1/128');
    for (let i = 0; i < 10; i++)
      expect((await hit(`203.0.113.${i + 1},192.0.2.10`)).status).toBe(200);
    expect((await hit('198.51.100.99,192.0.2.10')).status).toBe(429);
  });

  it('isolates IPv6 clients through the same trusted IPv4 proxy', async () => {
    await start('127.0.0.1/32,::1/128,192.0.2.0/24');
    for (let i = 0; i < 10; i++) {
      expect((await hit('2001:db8:1::1,192.0.2.10')).status).toBe(200);
      expect((await hit('2001:db8:2::1,192.0.2.10')).status).toBe(200);
    }
    expect((await hit('198.51.100.1,2001:db8:1::1,192.0.2.10')).status).toBe(
      429,
    );
    expect((await hit('2001:db8:2::1,192.0.2.10')).status).toBe(429);
  });

  it('shares a conservative socket budget when the forwarded header is missing', async () => {
    await start('127.0.0.1/32,::1/128');
    for (let i = 0; i < 10; i++) expect((await hit()).status).toBe(200);
    expect((await hit()).status).toBe(429);
  });

  it.each(['true', '1', '*', '0.0.0.0/0', '::/0', 'loopback', 'not-an-ip'])(
    'rejects unsafe or ambiguous proxy configuration %s before serving',
    (cidrs) => {
      process.env.TRUST_PROXY_CIDRS = cidrs;
      expect(() => configureApp(app)).toThrow(
        'PRODUCTION_CONFIG_INVALID:TRUST_PROXY_CIDRS',
      );
    },
  );
});
