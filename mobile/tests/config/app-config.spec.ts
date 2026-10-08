import type { ConfigContext } from 'expo/config';
import createAppConfig from '../../app.config';

describe('native app configuration', () => {
  const context: ConfigContext = {
    projectRoot: '.',
    staticConfigPath: null,
    packageJsonPath: null,
    config: {},
  };
  const envKeys = [
    'EXPO_PUBLIC_EAS_PROJECT_ID',
    'EXPO_PUBLIC_ANDROID_APPLICATION_ID',
    'EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER',
    'GOOGLE_SERVICES_FILE',
    'EAS_BUILD_PROFILE',
    'EAS_BUILD',
    'EXPO_PUBLIC_API_URL',
    'AVISA_PREVIEW_ALLOW_CLEARTEXT_TRAFFIC',
  ];
  let previousEnv: Record<string, string | undefined>;

  beforeEach(() => {
    previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    for (const key of envKeys) delete process.env[key];
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  });

  it('preserves the app.json settings alongside the push configuration', () => {
    const config = createAppConfig(context);
    expect(config).toMatchObject({
      name: 'mobile',
      slug: 'mobile',
      version: '1.0.0',
      orientation: 'portrait',
      icon: './assets/icon.png',
      userInterfaceStyle: 'light',
      ios: { supportsTablet: true, bundleIdentifier: 'com.avisa.aiprofessor' },
      android: {
        package: 'com.avisa.aiprofessor',
        adaptiveIcon: {
          backgroundColor: '#E6F4FE',
          foregroundImage: './assets/android-icon-foreground.png',
          backgroundImage: './assets/android-icon-background.png',
          monochromeImage: './assets/android-icon-monochrome.png',
        },
        predictiveBackGestureEnabled: false,
      },
      web: { favicon: './assets/favicon.png' },
      extra: { eas: { projectId: '70c1f8a0-48dc-4ef4-bbc0-1a1fa56da0b9' } },
    });
    expect(config.plugins).toEqual([
      'expo-router',
      'expo-secure-store',
      'expo-status-bar',
      'expo-font',
      'expo-notifications',
      './plugins/with-push-storage-backup',
    ]);
    expect(config.android?.googleServicesFile).toBeUndefined();
  });

  it.each([
    '',
    'http://api.example.com/api/v1',
    'https://localhost/api/v1',
    'https://127.0.0.1/api/v1',
    'https://192.168.1.10/api/v1',
    'https://[::1]/api/v1',
    'https://api.example.com/api/v1?secret=value',
  ])('rejects unsafe production API %s', (url) => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = url;
    expect(() => createAppConfig(context)).toThrow('PRODUCTION_API_URL_INVALID');
  });

  it('production suppresses diagnostics and rejects inherited preview cleartext', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/api/v1';
    expect(createAppConfig(context).extra?.pushDiagnosticsEnabled).toBe(false);
    process.env.AVISA_PREVIEW_ALLOW_CLEARTEXT_TRAFFIC = 'true';
    expect(() => createAppConfig(context)).toThrow('PRODUCTION_CLEARTEXT_FORBIDDEN');
  });

  it('production rejects a different valid project ID or Android package', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/api/v1';
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID = '00000000-0000-4000-8000-000000000012';
    expect(() => createAppConfig(context)).toThrow('PRODUCTION_ANDROID_ID_INVALID');
    delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    process.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID = 'com.example.fixture';
    expect(() => createAppConfig(context)).toThrow('PRODUCTION_ANDROID_ID_INVALID');
  });

  it('production rejects backend secrets in public env and a missing Firebase build file', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/api/v1';
    process.env.EXPO_PUBLIC_JWT_SECRET = 'synthetic-only';
    try {
      expect(() => createAppConfig(context)).toThrow('PRODUCTION_PUBLIC_ENV_NOT_ALLOWED');
    } finally {
      delete process.env.EXPO_PUBLIC_JWT_SECRET;
    }
    process.env.EAS_BUILD = 'true';
    expect(() => createAppConfig(context)).toThrow('PRODUCTION_FIREBASE_CONFIG_REQUIRED');
  });

  it('preserves supplied settings and uses explicit public identifiers and Firebase file path', () => {
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID = '00000000-0000-4000-8000-000000000012';
    process.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID = 'com.example.fixture';
    process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER = 'com.example.fixture.ios';
    process.env.GOOGLE_SERVICES_FILE = './credentials/fixture-google-services.json';
    const config = createAppConfig({
      ...context,
      config: {
        name: 'Fixture',
        slug: 'fixture',
        orientation: 'landscape',
        ios: { supportsTablet: false },
        android: { predictiveBackGestureEnabled: true },
        web: { favicon: './fixture.png' },
        plugins: ['expo-router', 'expo-notifications'],
        extra: { fixture: true },
      },
    });
    expect(config).toMatchObject({
      name: 'Fixture',
      slug: 'fixture',
      orientation: 'landscape',
      ios: { supportsTablet: false, bundleIdentifier: 'com.example.fixture.ios' },
      android: {
        predictiveBackGestureEnabled: true,
        package: 'com.example.fixture',
        googleServicesFile: './credentials/fixture-google-services.json',
      },
      web: { favicon: './fixture.png' },
      extra: { fixture: true, eas: { projectId: '00000000-0000-4000-8000-000000000012' } },
    });
    expect(config.plugins).toEqual([
      'expo-router',
      'expo-notifications',
      './plugins/with-push-storage-backup',
    ]);
  });
});
