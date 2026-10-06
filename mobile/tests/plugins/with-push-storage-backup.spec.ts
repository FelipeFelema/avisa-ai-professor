import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyPushStorageBackupFiles,
  createDataExtractionRules,
  createFullBackupContent,
  setIosStorageBackupExclusion,
} from '../../plugins/with-push-storage-backup';

describe('push storage backup plugin rules', () => {
  it('merges the AsyncStorage database exclusion while preserving existing full backup rules', () => {
    const existing = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <include domain="sharedpref" path="." />
  <exclude domain="sharedpref" path="SecureStore" />
  <exclude domain="file" path="legacy-private.json" />
</full-backup-content>`;
    const merged = createFullBackupContent(existing);

    expect(merged).toContain('<include domain="sharedpref" path="." />');
    expect(merged).toContain('<exclude domain="sharedpref" path="SecureStore" />');
    expect(merged).toContain('<exclude domain="file" path="legacy-private.json" />');
    expect(merged).toContain('<exclude domain="database" path="RKStorage" />');
    expect(merged.match(/domain="database" path="RKStorage"/g)).toHaveLength(1);
  });

  it('excludes AsyncStorage from both Android cloud backup and device transfer', () => {
    const existing = `<data-extraction-rules>
  <cloud-backup><include domain="sharedpref" path="."/><exclude domain="sharedpref" path="SecureStore"/></cloud-backup>
  <device-transfer><include domain="sharedpref" path="."/><exclude domain="sharedpref" path="SecureStore"/></device-transfer>
</data-extraction-rules>`;
    const merged = createDataExtractionRules(existing);

    for (const section of ['cloud-backup', 'device-transfer']) {
      const match = merged.match(new RegExp(`<${section}>([\\s\\S]*?)</${section}>`));
      expect(match?.[1]).toContain('<exclude domain="database" path="RKStorage" />');
      expect(match?.[1]).toMatch(/<exclude domain="sharedpref" path="SecureStore"\s*\/>/);
    }
  });

  it('adds safe defaults to an empty config and fixes the iOS AsyncStorage exclusion flag', () => {
    expect(createFullBackupContent(undefined)).toContain(
      '<exclude domain="database" path="RKStorage" />',
    );
    expect(createDataExtractionRules(undefined)).toContain(
      '<exclude domain="database" path="RKStorage" />',
    );
    expect(setIosStorageBackupExclusion({})).toEqual({
      RCTAsyncStorageExcludeFromBackup: true,
    });
    expect(setIosStorageBackupExclusion({ RCTAsyncStorageExcludeFromBackup: false })).toEqual({
      RCTAsyncStorageExcludeFromBackup: true,
    });
  });

  it('merges existing Android resource fixtures without running native prebuild', async () => {
    const project = await mkdtemp(join(tmpdir(), 'push-backup-fixture-'));
    const xmlDirectory = join(project, 'app', 'src', 'main', 'res', 'xml');
    await mkdir(xmlDirectory, { recursive: true });
    await writeFile(
      join(xmlDirectory, 'existing_backup.xml'),
      '<full-backup-content><include domain="file" path="custom"/></full-backup-content>',
    );
    await writeFile(
      join(xmlDirectory, 'existing_rules.xml'),
      '<data-extraction-rules><cloud-backup><include domain="file" path="cloud"/></cloud-backup><device-transfer><include domain="file" path="transfer"/></device-transfer></data-extraction-rules>',
    );

    try {
      await applyPushStorageBackupFiles(project, {
        fullBackupContent: '@xml/existing_backup',
        dataExtractionRules: '@xml/existing_rules',
      });
      const backup = await readFile(join(xmlDirectory, 'avisa_push_backup_rules.xml'), 'utf8');
      const extraction = await readFile(
        join(xmlDirectory, 'avisa_push_data_extraction_rules.xml'),
        'utf8',
      );
      expect(backup).toContain('<include domain="file" path="custom"/>');
      expect(backup).toContain('domain="sharedpref" path="SecureStore"');
      expect(backup).toContain('domain="database" path="RKStorage"');
      expect(extraction).toContain('<include domain="file" path="cloud"/>');
      expect(extraction).toContain('<include domain="file" path="transfer"/>');
      expect(extraction.match(/domain="database" path="RKStorage"/g)).toHaveLength(2);
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  });
});
