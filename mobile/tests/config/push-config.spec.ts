import { resolvePushRuntimeConfig, resolvePushTestActionEnabled } from '@/config/push-config';
import appConfig from '../../app.config';

describe('push runtime configuration', () => {
  const base = {
    device: { isDevice: true },
    constants: {
      appOwnership: null,
      easConfig: { projectId: '00000000-0000-4000-8000-000000000010' },
      expoConfig: { extra: { eas: { projectId: undefined } } },
    },
    env: {
      EXPO_PUBLIC_ANDROID_APPLICATION_ID: 'com.example.avisa',
      EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER: 'com.example.avisa',
    },
  };

  it('uses the EAS project ID and platform application identifier from the current native build', () => {
    expect(resolvePushRuntimeConfig({ ...base, platform: 'android' })).toEqual({
      available: true,
      platform: 'ANDROID',
      projectId: '00000000-0000-4000-8000-000000000010',
      reason: null,
    });
    expect(resolvePushRuntimeConfig({ ...base, platform: 'ios' })).toMatchObject({
      available: true,
      platform: 'IOS',
    });
  });

  it('resolves the project ID from app config when the environment variable is absent', () => {
    expect(
      resolvePushRuntimeConfig({
        ...base,
        platform: 'android',
        constants: {
          appOwnership: null,
          easConfig: null,
          expoConfig: {
            extra: { eas: { projectId: '00000000-0000-4000-8000-000000000012' } },
          },
        },
      }).projectId,
    ).toBe('00000000-0000-4000-8000-000000000012');
  });

  it('uses native build identifiers without requiring duplicate environment variables', () => {
    const input = {
      ...base,
      env: {},
      constants: {
        ...base.constants,
        expoConfig: {
          android: { package: 'com.avisa.aiprofessor' },
          ios: { bundleIdentifier: 'com.avisa.aiprofessor' },
        },
      },
    };
    expect(resolvePushRuntimeConfig({ ...input, platform: 'android' }).available).toBe(true);
    expect(resolvePushRuntimeConfig({ ...input, platform: 'ios' }).available).toBe(true);
  });

  it('returns unavailable for missing project/app identity, web, simulator, or Expo Go', () => {
    const noProject = resolvePushRuntimeConfig({
      ...base,
      platform: 'android',
      constants: { appOwnership: null, easConfig: null, expoConfig: null },
    });
    expect(noProject).toMatchObject({ available: false, reason: 'CONFIGURATION_UNAVAILABLE' });

    const noAppId = resolvePushRuntimeConfig({
      ...base,
      platform: 'ios',
      env: { EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER: '' },
    });
    expect(noAppId.available).toBe(false);

    const web = resolvePushRuntimeConfig({ ...base, platform: 'web' });
    expect(web).toMatchObject({ available: false, reason: 'UNSUPPORTED_PLATFORM' });

    const simulator = resolvePushRuntimeConfig({
      ...base,
      platform: 'android',
      device: { isDevice: false },
    });
    expect(simulator).toMatchObject({ available: false, reason: 'DEVICE_UNAVAILABLE' });

    const expoGo = resolvePushRuntimeConfig({
      ...base,
      platform: 'android',
      constants: { ...base.constants, appOwnership: 'expo' },
    });
    expect(expoGo).toMatchObject({ available: false, reason: 'DEVICE_UNAVAILABLE' });
  });
});

describe('push diagnostic action configuration', () => {
  it.each([
    [true, undefined, true],
    [false, true, true],
    [false, false, false],
    [false, undefined, false],
    [false, 'true', false],
  ])('development=%s, configured=%s gives visible=%s', (development, configured, visible) => {
    expect(resolvePushTestActionEnabled(development, configured)).toBe(visible);
  });

  it.each([
    ['preview', true],
    ['development', true],
    ['production', false],
    [undefined, false],
    ['other', false],
  ])('build profile %s produces diagnostic visibility %s', (profile, visible) => {
    const previous = process.env.EAS_BUILD_PROFILE;
    try {
      if (profile === undefined) delete process.env.EAS_BUILD_PROFILE;
      else process.env.EAS_BUILD_PROFILE = profile;
      const config = appConfig({
        projectRoot: 'synthetic-project',
        staticConfigPath: null,
        packageJsonPath: null,
        config: { name: 'mobile', slug: 'mobile', extra: { pushDiagnosticsEnabled: true } },
      });
      expect(config.extra?.pushDiagnosticsEnabled).toBe(visible);
      expect(resolvePushTestActionEnabled(false, config.extra?.pushDiagnosticsEnabled)).toBe(
        visible,
      );
    } finally {
      if (previous === undefined) delete process.env.EAS_BUILD_PROFILE;
      else process.env.EAS_BUILD_PROFILE = previous;
    }
  });
});
