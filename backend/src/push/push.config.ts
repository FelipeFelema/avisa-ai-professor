import { registerAs } from '@nestjs/config';

export interface PushConfig {
  enabled: boolean;
  accessToken?: string;
}

export function createPushConfig(
  env: NodeJS.ProcessEnv = process.env,
): PushConfig {
  const requested = env.EXPO_PUSH_ENABLED === 'true';
  const accessToken = env.EXPO_PUSH_ACCESS_TOKEN?.trim();
  const enabled = requested && Boolean(accessToken);

  return {
    enabled,
    accessToken: enabled ? accessToken : undefined,
  };
}

export const pushConfig = registerAs('push', () => createPushConfig());
