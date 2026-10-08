import { EventEmitter } from 'node:events';
import { createHmac } from 'node:crypto';
import type { Request, Response } from 'express';
import {
  createSec013ProxyDiagnostics,
  observeSec013LimiterKey,
  SEC013_LOG_LABEL,
} from './proxy-diagnostics.middleware';
import { proxyDiagnosticsKey } from '../../config/proxy-diagnostics.config';

// Public test-only material. Never use this fixture key in a deployed environment.
const fixtureKey = '0123456789abcdef'.repeat(4);
const enabled = {
  SEC013_PROXY_DIAGNOSTICS: 'true',
  SEC013_PROXY_DIAGNOSTICS_HMAC_KEY: fixtureKey,
};

type Fingerprint = {
  valid?: boolean;
  fingerprint?: string;
  addressFingerprint?: string;
  exactKeyFingerprint?: string;
};
type ProbeRecord = {
  label: string;
  observerId: string;
  sequence: number;
  socket: Fingerprint;
  limiterKey: Fingerprint | null;
  headers: Record<string, { values: Fingerprint[]; truncated?: boolean }>;
};
function parseRecord(line: string): ProbeRecord {
  return JSON.parse(line) as ProbeRecord;
}

describe('temporary SEC-013 observer', () => {
  let now: number;
  let lines: string[];
  let emit: jest.Mock;
  beforeEach(() => {
    now = 0;
    lines = [];
    emit = jest.fn((line: string) => lines.push(line));
  });

  function probe(
    middleware = createSec013ProxyDiagnostics(enabled, emit, () => now)!,
    changes: Partial<Request> = {},
    finish = true,
  ) {
    const req = {
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-avisa-proxy-probe': 'PC' },
      socket: { remoteAddress: '::ffff:192.0.2.10' },
      ...changes,
    } as unknown as Request;
    Object.defineProperty(req, 'body', {
      get: () => {
        throw new Error('must-not-read-body');
      },
    });
    const res = Object.assign(new EventEmitter(), { statusCode: 429 });
    const next = jest.fn();
    middleware(req, res as unknown as Response, next);
    observeSec013LimiterKey(req, '::ffff:192.0.2.10');
    if (finish) res.emit('finish');
    expect(next).toHaveBeenCalledTimes(1);
    return { req, res };
  }

  it.each([undefined, 'false'])(
    'is off for flag %s, even with an invalid key',
    (flag) => {
      expect(
        createSec013ProxyDiagnostics(
          {
            SEC013_PROXY_DIAGNOSTICS: flag,
            SEC013_PROXY_DIAGNOSTICS_HMAC_KEY: 'secret',
          },
          emit,
        ),
      ).toBeUndefined();
    },
  );
  it.each(['TRUE', '1', '', 'yes'])(
    'rejects ambiguous enable flag %s',
    (flag) => {
      expect(() =>
        proxyDiagnosticsKey({ SEC013_PROXY_DIAGNOSTICS: flag }),
      ).toThrow('SEC013_DIAGNOSTICS_CONFIG_INVALID:ENABLE_FLAG');
    },
  );
  it.each([
    undefined,
    '',
    'jwt-secret',
    '0'.repeat(64),
    'a'.repeat(63),
    'z'.repeat(64),
  ])('fails startup with an invalid key without echoing it (%s)', (key) => {
    expect(() =>
      proxyDiagnosticsKey({
        ...enabled,
        SEC013_PROXY_DIAGNOSTICS_HMAC_KEY: key,
      }),
    ).toThrow('SEC013_DIAGNOSTICS_CONFIG_INVALID:HMAC_KEY');
  });
  it.each([
    { method: 'GET' },
    { path: '/api/v1/auth/register' },
    { path: '/api/v1/auth/login/extra' },
    { path: '/auth/login' },
    { headers: {} },
    { headers: { 'x-avisa-proxy-probe': 'secret-marker' } },
    { headers: { 'x-avisa-proxy-probe': ['PC', 'MOBILE'] } },
  ])('ignores non-probes %j', (changes) => {
    probe(undefined, changes);
    expect(lines).toEqual([]);
  });
  it('caps at 20 reservations even when concurrent responses have not finished', () => {
    const observer = createSec013ProxyDiagnostics(enabled, emit, () => now)!;
    const pending = Array.from({ length: 25 }, () =>
      probe(observer, {}, false),
    );
    expect(lines).toHaveLength(0);
    pending.reverse().forEach(({ res }) => res.emit('finish'));
    expect(lines).toHaveLength(20);
    expect(new Set(lines.map((line) => parseRecord(line).sequence)).size).toBe(
      20,
    );
    probe(observer);
    expect(lines).toHaveLength(20);
  });
  it('expires from initialization, including a request that finishes after the deadline', () => {
    const observer = createSec013ProxyDiagnostics(enabled, emit, () => now)!;
    now = 179_999;
    probe(observer);
    const pending = probe(observer, {}, false);
    now = 180_000;
    pending.res.emit('finish');
    probe(observer);
    expect(lines).toHaveLength(1);
  });
  it('does not retain the hook after finish or let logger failure affect requests', () => {
    const observer = createSec013ProxyDiagnostics(
      enabled,
      () => {
        throw new Error('private-error');
      },
      () => now,
    )!;
    const { req, res } = probe(observer);
    expect(Object.getOwnPropertySymbols(req)).toHaveLength(0);
    expect(res.listenerCount('finish')).toBe(0);
    expect(() => observeSec013LimiterKey(req, 'other')).not.toThrow();
  });
  it('does not infer an effective key when a parser rejects before the guard', () => {
    const observer = createSec013ProxyDiagnostics(enabled, emit, () => now)!;
    const req = {
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-avisa-proxy-probe': 'MOBILE' },
      socket: {},
    } as unknown as Request;
    const res = Object.assign(new EventEmitter(), { statusCode: 400 });
    observer(req, res as unknown as Response, jest.fn());
    res.emit('finish');
    expect(parseRecord(lines[0]).limiterKey).toBeNull();
  });
  it('hashes only valid selected IP values, preserves chain position, and never reads body or sensitive headers', () => {
    const reqHeaders = {
      'x-avisa-proxy-probe': 'PC',
      'x-forwarded-for': '203.0.113.1,192.0.2.10,invalid-private-value',
      'cf-connecting-ip': '203.0.113.1',
      'cf-connecting-ipv6': '2001:0DB8:0:0:0:0:0:1',
      'true-client-ip': '203.0.113.1,secret-value',
      'x-real-ip': '::ffff:c000:20a',
      forwarded:
        'for=203.0.113.1;proto=https;host=private-host,for="[2001:db8::1]:443",for=192.0.2.10:1234,for=unknown,for=192.0.2.10;for=203.0.113.1',
    };
    for (const name of ['authorization', 'cookie', 'x-push-capability'])
      Object.defineProperty(reqHeaders, name, {
        get: () => {
          throw new Error('must-not-read');
        },
      });
    const observer = createSec013ProxyDiagnostics(enabled, emit, () => now)!;
    const { res } = probe(observer, { headers: reqHeaders }, false);
    res.emit('finish');
    expect(lines).toHaveLength(1);
    const record = parseRecord(lines[0]);
    expect(record.label).toBe(SEC013_LOG_LABEL);
    const expected = createHmac('sha256', Buffer.from(fixtureKey, 'hex'))
      .update('::ffff:192.0.2.10')
      .digest('hex');
    expect(record.limiterKey?.exactKeyFingerprint).toBe(expected);
    expect(record.socket.fingerprint).toBe(expected);
    expect(record.socket.addressFingerprint).toBe(
      record.headers['x-real-ip'].values[0].addressFingerprint,
    );
    expect(record.headers['x-forwarded-for'].values[1].addressFingerprint).toBe(
      record.socket.addressFingerprint,
    );
    expect(record.headers.forwarded.values[1].addressFingerprint).toBe(
      record.headers['cf-connecting-ipv6'].values[0].addressFingerprint,
    );
    expect(record.headers.forwarded.values[2].valid).toBe(true);
    expect(record.headers.forwarded.values[3].valid).toBe(false);
    expect(record.headers.forwarded.values[4].valid).toBe(false);
    expect(record.headers['true-client-ip'].values[0].valid).toBe(false);
    for (const forbidden of [
      fixtureKey,
      '192.0.2.10',
      '203.0.113.1',
      '2001:',
      'invalid-private-value',
      'secret-value',
      'private-host',
      'authorization',
      'cookie',
      'capability',
      'body',
    ])
      expect(lines[0]).not.toContain(forbidden);
  });
  it('bounds lists and rejects oversized or array-valued headers without hashing invalid input', () => {
    probe(undefined, {
      headers: {
        'x-avisa-proxy-probe': 'PC',
        'x-forwarded-for': Array.from({ length: 10 }, () => '192.0.2.1').join(
          ',',
        ),
        'cf-connecting-ip': 'x'.repeat(2049),
        'x-real-ip': ['192.0.2.1', '192.0.2.2'],
      },
    });
    const record = parseRecord(lines[0]);
    expect(record.headers['x-forwarded-for'].values).toHaveLength(8);
    expect(record.headers['x-forwarded-for'].truncated).toBe(true);
    expect(record.headers['cf-connecting-ip']).toEqual({
      present: true,
      invalid: true,
      truncated: true,
    });
    expect(record.headers['x-real-ip']).toEqual({
      present: true,
      invalid: true,
      truncated: true,
    });
  });
  it('uses the supplied key consistently across instances, and rotation changes fingerprints', () => {
    probe();
    probe();
    expect(parseRecord(lines[0]).observerId).not.toBe(
      parseRecord(lines[1]).observerId,
    );
    expect(parseRecord(lines[0]).socket).toEqual(parseRecord(lines[1]).socket);
    probe(
      createSec013ProxyDiagnostics(
        {
          ...enabled,
          SEC013_PROXY_DIAGNOSTICS_HMAC_KEY: 'fedcba9876543210'.repeat(4),
        },
        emit,
        () => now,
      ),
    );
    expect(parseRecord(lines[2]).socket.fingerprint).not.toBe(
      parseRecord(lines[0]).socket.fingerprint,
    );
  });
  it('classifies scoped IPv6 header input as invalid without losing the socket/key record', () => {
    probe(undefined, {
      headers: {
        'x-avisa-proxy-probe': 'PC',
        'cf-connecting-ipv6': 'fe80::1%eth0',
      },
    });
    expect(lines).toHaveLength(1);
    expect(
      parseRecord(lines[0]).headers['cf-connecting-ipv6'].values[0],
    ).toEqual({ present: true, valid: false });
    expect(parseRecord(lines[0]).limiterKey?.exactKeyFingerprint).toBeDefined();
    expect(lines[0]).not.toContain('eth0');
  });
});
