import type { ExpoConfig } from 'expo/config';

declare function withPushStorageBackup(config: ExpoConfig): ExpoConfig;

export function createDataExtractionRules(existing?: string): string;
export function createFullBackupContent(existing?: string): string;
export function setIosStorageBackupExclusion<T extends Record<string, unknown>>(
  infoPlist: T,
): T & { RCTAsyncStorageExcludeFromBackup: true };
export function applyPushStorageBackupFiles(
  androidProjectRoot: string,
  references?: { fullBackupContent?: string; dataExtractionRules?: string },
): Promise<void>;

export default withPushStorageBackup;
