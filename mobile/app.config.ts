import type { ExpoConfig, ConfigContext } from 'expo/config';

// Runs during config resolution, before export/build; never embeds backend credentials.
function validateProductionEnvironment(env: NodeJS.ProcessEnv): void {
  if (env.EAS_BUILD_PROFILE !== 'production') return;
  try {
    const url = new URL(env.EXPO_PUBLIC_API_URL ?? '');
    const host = url.hostname.replace(/\.$/, '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.test') ||
      host.includes(':') ||
      /^\[/.test(host) ||
      /^[\d.]+$/.test(host) ||
      url.pathname.replace(/\/$/, '') !== '/api/v1'
    )
      throw new Error();
  } catch {
    throw new Error('PRODUCTION_API_URL_INVALID');
  }
  if (env.AVISA_PREVIEW_ALLOW_CLEARTEXT_TRAFFIC === 'true')
    throw new Error('PRODUCTION_CLEARTEXT_FORBIDDEN');
  const publicKeys = [
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_EAS_PROJECT_ID',
    'EXPO_PUBLIC_ANDROID_APPLICATION_ID',
    'EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER',
  ];
  if (Object.keys(env).some((key) => key.startsWith('EXPO_PUBLIC_') && !publicKeys.includes(key)))
    throw new Error('PRODUCTION_PUBLIC_ENV_NOT_ALLOWED');
  if (env.EAS_BUILD === 'true' && !env.GOOGLE_SERVICES_FILE?.trim())
    throw new Error('PRODUCTION_FIREBASE_CONFIG_REQUIRED');
}

export default ({ config }: ConfigContext): ExpoConfig => {
  validateProductionEnvironment(process.env);
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || '70c1f8a0-48dc-4ef4-bbc0-1a1fa56da0b9';
  const androidApplicationId =
    process.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID?.trim() || 'com.avisa.aiprofessor';
  const iosBundleIdentifier =
    process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER?.trim() || 'com.avisa.aiprofessor';
  const googleServicesFile = process.env.GOOGLE_SERVICES_FILE?.trim();
  if (
    process.env.EAS_BUILD_PROFILE === 'production' &&
    (androidApplicationId !== 'com.avisa.aiprofessor' ||
      projectId !== '70c1f8a0-48dc-4ef4-bbc0-1a1fa56da0b9')
  )
    throw new Error('PRODUCTION_ANDROID_ID_INVALID');
  const currentPlugins = Array.isArray(config.plugins)
    ? config.plugins
    : ['expo-router', 'expo-secure-store', 'expo-status-bar', 'expo-font'];
  const plugins = currentPlugins.filter(
    (plugin) => plugin !== 'expo-notifications' && plugin !== './plugins/with-push-storage-backup',
  );

  return {
    ...config,
    name: config.name ?? 'mobile',
    slug: config.slug ?? 'mobile',
    version: config.version ?? '1.0.0',
    orientation: config.orientation ?? 'portrait',
    icon: config.icon ?? './assets/icon.png',
    userInterfaceStyle: config.userInterfaceStyle ?? 'light',
    ios: {
      supportsTablet: true,
      ...config.ios,
      bundleIdentifier: iosBundleIdentifier,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      ...config.android,
      package: androidApplicationId,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    web: {
      favicon: './assets/favicon.png',
      ...config.web,
    },
    plugins: [...plugins, 'expo-notifications', './plugins/with-push-storage-backup'],
    extra: {
      ...config.extra,
      pushDiagnosticsEnabled:
        process.env.EAS_BUILD_PROFILE === 'preview' ||
        process.env.EAS_BUILD_PROFILE === 'development',
      eas: {
        ...config.extra?.eas,
        ...(projectId ? { projectId } : {}),
      },
    },
  };
};
