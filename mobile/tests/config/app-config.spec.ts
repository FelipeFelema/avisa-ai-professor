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
