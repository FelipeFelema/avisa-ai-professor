import { isIP } from 'node:net';
import { trustedProxyCidrs } from './trusted-proxy.config';

function fail(key: string): never {
  throw new Error(`PRODUCTION_CONFIG_INVALID:${key}`);
}

export function productionCorsOrigins(env: NodeJS.ProcessEnv): string[] {
  const origins = env.CORS_ORIGIN?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origins?.length) return fail('CORS_ORIGIN');
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (
        url.protocol !== 'https:' ||
        url.origin !== origin ||
        url.username ||
        url.password ||
        url.hostname.replace(/\.$/, '') === 'localhost' ||
        url.hostname.replace(/\.$/, '').endsWith('.localhost') ||
        url.hostname.endsWith('.local') ||
        isIP(url.hostname.replace(/^\[|\]$/g, ''))
      )
        fail('CORS_ORIGIN');
    } catch {
      fail('CORS_ORIGIN');
    }
  }
  return origins;
}

export function validateProductionConfig(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  trustedProxyCidrs(env);
  if (env.NODE_ENV !== 'production') return env;
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const secret = env[key]?.trim();
    if (
      !secret ||
      secret.length < 32 ||
      /replace|example|changeme|synthetic/i.test(secret) ||
      new Set(secret).size < 12
    )
      fail(key);
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET)
    fail('JWT_SECRETS_DISTINCT');
  try {
    const db = new URL(env.DATABASE_URL ?? '');
    if (
      !['postgres:', 'postgresql:'].includes(db.protocol) ||
      !db.hostname ||
      !db.username ||
      !db.password ||
      /^(postgres|password|changeme)$|replace|example/i.test(
        decodeURIComponent(db.password),
      ) ||
      db.pathname === '/'
    )
      fail('DATABASE_URL');
  } catch {
    fail('DATABASE_URL');
  }
  productionCorsOrigins(env);
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail('PORT');
  for (const key of [
    'EXPO_PUSH_ENABLED',
    'ANNOUNCEMENT_PUSH_ENABLED',
    'ANNOUNCEMENT_PUSH_REMINDERS_ENABLED',
  ]) {
    if (env[key] !== undefined && !['true', 'false'].includes(env[key]))
      fail(key);
  }
  if (
    env.EXPO_PUSH_ENABLED === 'true' &&
    (!env.EXPO_PUSH_ACCESS_TOKEN?.trim() ||
      /replace|example|changeme|synthetic/i.test(env.EXPO_PUSH_ACCESS_TOKEN))
  ) {
    fail('EXPO_PUSH_ACCESS_TOKEN');
  }
  if (
    env.ANNOUNCEMENT_PUSH_ENABLED === 'true' &&
    env.EXPO_PUSH_ENABLED !== 'true'
  )
    fail('ANNOUNCEMENT_PUSH_ENABLED');
  if (
    env.ANNOUNCEMENT_PUSH_REMINDERS_ENABLED === 'true' &&
    env.ANNOUNCEMENT_PUSH_ENABLED !== 'true'
  )
    fail('ANNOUNCEMENT_PUSH_REMINDERS_ENABLED');
  return env;
}
