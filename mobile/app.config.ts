import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || '70c1f8a0-48dc-4ef4-bbc0-1a1fa56da0b9';
  const androidApplicationId =
    process.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID?.trim() || 'com.avisa.aiprofessor';
  const iosBundleIdentifier =
    process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER?.trim() || 'com.avisa.aiprofessor';
  const googleServicesFile = process.env.GOOGLE_SERVICES_FILE?.trim();
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
      eas: {
        ...config.extra?.eas,
        ...(projectId ? { projectId } : {}),
      },
    },
  };
};
