import { createPushConfig } from './push.config';

describe('createPushConfig', () => {
  it('keeps push disabled when the flag is absent', () => {
    expect(createPushConfig({})).toEqual({
      enabled: false,
      accessToken: undefined,
    });
  });

  it('enables push only when the flag and a non-empty private token are present', () => {
    expect(
      createPushConfig({
        EXPO_PUSH_ENABLED: 'true',
        EXPO_PUSH_ACCESS_TOKEN: 'synthetic-expo-access-token',
      }),
    ).toEqual({ enabled: true, accessToken: 'synthetic-expo-access-token' });
  });

  it('degrades push only when enabled without an access token', () => {
    expect(createPushConfig({ EXPO_PUSH_ENABLED: 'true' })).toEqual({
      enabled: false,
      accessToken: undefined,
    });
    expect(
      createPushConfig({
        EXPO_PUSH_ENABLED: 'true',
        EXPO_PUSH_ACCESS_TOKEN: '   ',
      }),
    ).toEqual({ enabled: false, accessToken: undefined });
  });

  it('fails closed for invalid flags and does not expose a token while disabled', () => {
    expect(
      createPushConfig({
        EXPO_PUSH_ENABLED: 'yes',
        EXPO_PUSH_ACCESS_TOKEN: 'synthetic-expo-access-token',
      }),
    ).toEqual({ enabled: false, accessToken: undefined });
    expect(
      createPushConfig({
        EXPO_PUSH_ENABLED: 'false',
        EXPO_PUSH_ACCESS_TOKEN: 'synthetic-expo-access-token',
      }),
    ).toEqual({ enabled: false, accessToken: undefined });
  });
});
