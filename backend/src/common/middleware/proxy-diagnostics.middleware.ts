// TEMPORARY SEC-013: remove after the approved production collection.
import { Logger } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { performance } from 'node:perf_hooks';
import type { Request, RequestHandler } from 'express';
import { proxyDiagnosticsKey } from '../../config/proxy-diagnostics.config';

export const SEC013_LOG_LABEL =
  'SEC013_PROXY_DIAGNOSTICS_REMOVE_AFTER_COLLECTION';
const observeKey = Symbol('temporary-sec013-limiter-observer');
type ObservedRequest = { [observeKey]?: (key: string) => void };

/** Observe the exact Map key, including rejected requests. Never choose a key. */
export function observeSec013LimiterKey(request: object, key: string): void {
  try {
    (request as ObservedRequest)[observeKey]?.(key);
  } catch {
    // Instrumentation must not change authentication or limiter behavior.
  }
}

function normalizedIp(value: string): string | undefined {
  if (isIP(value) === 4) return value;
  if (isIP(value) !== 6 || value.includes('%')) return undefined;
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/i.exec(canonical);
  if (!mapped) return canonical;
  const bits = parseInt(mapped[1], 16) * 65536 + parseInt(mapped[2], 16);
  return [24, 16, 8, 0].map((shift) => (bits >>> shift) & 255).join('.');
}

function forwardedAddress(entry: string): string {
  const fields = entry.split(';');
  const values = fields.filter((part) => /^\s*for=/i.test(part));
  if (values.length !== 1) return '';
  let value = values[0].replace(/^\s*for=/i, '').trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(value);
  if (bracketed) return bracketed[1];
  if (isIP(value)) return value;
  const ipv4Port = /^(\d+\.\d+\.\d+\.\d+):\d{1,5}$/.exec(value);
  return ipv4Port?.[1] ?? '';
}

export function createSec013ProxyDiagnostics(
  env: NodeJS.ProcessEnv = process.env,
  emit: (line: string) => void = (line) =>
    new Logger('Sec013ProxyDiagnostics').log(line),
  clock: () => number = () => performance.now(),
): RequestHandler | undefined {
  const key = proxyDiagnosticsKey(env);
  if (!key) return undefined;
  const started = clock();
  const observerId = randomUUID();
  let reserved = 0;
  const digest = (value: string) =>
    createHmac('sha256', key).update(value).digest('hex');
  const describe = (value: string | undefined) => {
    const canonical = value === undefined ? undefined : normalizedIp(value);
    return canonical === undefined
      ? { present: value !== undefined, valid: false }
      : {
          present: true,
          valid: true,
          family: isIP(canonical),
          fingerprint: digest(value!),
          addressFingerprint: digest(canonical),
        };
  };
  const headers = (req: Request) =>
    Object.fromEntries(
      [
        'x-forwarded-for',
        'cf-connecting-ip',
        'cf-connecting-ipv6',
        'true-client-ip',
        'x-real-ip',
        'forwarded',
      ].map((name) => {
        const raw = req.headers[name];
        if (raw === undefined) return [name, { present: false }];
        if (typeof raw !== 'string' || raw.length > 2048)
          return [name, { present: true, invalid: true, truncated: true }];
        const chain = name === 'x-forwarded-for' || name === 'forwarded';
        const parts = chain ? raw.split(',') : [raw];
        return [
          name,
          {
            present: true,
            truncated: parts.length > 8,
            values: parts
              .slice(0, 8)
              .map((part) =>
                describe(
                  name === 'forwarded' ? forwardedAddress(part) : part.trim(),
                ),
              ),
          },
        ];
      }),
    );
  return (req, res, next) => {
    try {
      const elapsed = clock() - started;
      const probe = req.headers['x-avisa-proxy-probe'];
      if (
        elapsed >= 0 &&
        elapsed < 180_000 &&
        reserved < 20 &&
        req.method === 'POST' &&
        req.path === '/api/v1/auth/login' &&
        (probe === 'PC' || probe === 'MOBILE')
      ) {
        const sequence = ++reserved;
        const socket = describe(req.socket.remoteAddress);
        const selectedHeaders = headers(req);
        let limiterKey:
          | (ReturnType<typeof describe> & { exactKeyFingerprint?: string })
          | null = null;
        (req as ObservedRequest)[observeKey] = (value) => {
          limiterKey = {
            ...describe(value),
            exactKeyFingerprint: digest(value),
          };
        };
        res.once('finish', () => {
          delete (req as ObservedRequest)[observeKey];
          try {
            const finishedAt = clock() - started;
            if (finishedAt < 0 || finishedAt >= 180_000) return;
            emit(
              JSON.stringify({
                label: SEC013_LOG_LABEL,
                observerId,
                sequence,
                elapsedMs: Math.floor(finishedAt),
                probe,
                status: res.statusCode,
                socket,
                limiterKey,
                headers: selectedHeaders,
              }),
            );
          } catch {
            // No raw error logging: logger failures must not expose input.
          }
        });
      }
    } catch {
      // No raw error logging; no effect on request handling.
    }
    next();
  };
}
