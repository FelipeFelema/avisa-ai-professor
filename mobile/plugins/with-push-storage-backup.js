const fs = require('node:fs/promises');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const FULL_BACKUP_RESOURCE = 'avisa_push_backup_rules';
const EXTRACTION_RESOURCE = 'avisa_push_data_extraction_rules';
const SECURE_STORE_EXCLUSION = '<exclude domain="sharedpref" path="SecureStore" />';
const ASYNC_STORAGE_EXCLUSION = '<exclude domain="database" path="RKStorage" />';

function addRootExclusion(xml, rootTag, exclusion) {
  const source = xml ?? '';
  if (!new RegExp(`<${rootTag}(?:\\s|>)`).test(source)) {
    throw new Error(`Invalid Android backup rules: missing ${rootTag} root element.`);
  }
  const fingerprint = exclusion.match(/domain="([^"]+)" path="([^"]+)"/);
  if (fingerprint && source.includes(`domain="${fingerprint[1]}" path="${fingerprint[2]}"`)) {
    return source;
  }
  return source.replace(new RegExp(`</${rootTag}\\s*>`), `  ${exclusion}\n</${rootTag}>`);
}

function createFullBackupContent(existing) {
  const source =
    existing ??
    `<?xml version="1.0" encoding="utf-8"?>\n<full-backup-content>\n  ${SECURE_STORE_EXCLUSION}\n</full-backup-content>\n`;
  return addRootExclusion(
    addRootExclusion(source, 'full-backup-content', SECURE_STORE_EXCLUSION),
    'full-backup-content',
    ASYNC_STORAGE_EXCLUSION,
  );
}

function addExtractionSection(xml, section) {
  const pattern = new RegExp(`(<${section}(?:\\s[^>]*)?>)([\\s\\S]*?)(</${section}\\s*>)`);
  const match = xml.match(pattern);
  if (!match) {
    return xml.replace(
      /<data-extraction-rules(?:\s[^>]*)?>/,
      (root) =>
        `${root}\n  <${section}>\n    ${SECURE_STORE_EXCLUSION}\n    ${ASYNC_STORAGE_EXCLUSION}\n  </${section}>`,
    );
  }
  let sectionBody = match[2];
  if (!sectionBody.includes('domain="sharedpref" path="SecureStore"')) {
    sectionBody = `${sectionBody.trimEnd()}\n    ${SECURE_STORE_EXCLUSION}`;
  }
  if (!sectionBody.includes('domain="database" path="RKStorage"')) {
    sectionBody = `${sectionBody.trimEnd()}\n    ${ASYNC_STORAGE_EXCLUSION}`;
  }
  if (sectionBody === match[2]) return xml;
  return xml.replace(pattern, `${match[1]}${sectionBody}\n  ${match[3]}`);
}

function createDataExtractionRules(existing) {
  let source =
    existing ??
    `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n  <cloud-backup>\n    ${SECURE_STORE_EXCLUSION}\n  </cloud-backup>\n  <device-transfer>\n    ${SECURE_STORE_EXCLUSION}\n  </device-transfer>\n</data-extraction-rules>\n`;
  if (!/<data-extraction-rules(?:\s|>)/.test(source)) {
    throw new Error('Invalid Android data extraction rules: missing root element.');
  }
  source = addExtractionSection(source, 'cloud-backup');
  source = addExtractionSection(source, 'device-transfer');
  return source;
}

function setIosStorageBackupExclusion(infoPlist) {
  return { ...infoPlist, RCTAsyncStorageExcludeFromBackup: true };
}

function getResourceName(reference, fallback) {
  if (typeof reference !== 'string') return fallback;
  const match = reference.match(/^@xml\/([A-Za-z0-9_]+)$/);
  return match?.[1] ?? fallback;
}

async function readRuleFile(xmlDirectory, resourceName) {
  try {
    return await fs.readFile(path.join(xmlDirectory, `${resourceName}.xml`), 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function applyPushStorageBackupFiles(androidProjectRoot, references = {}) {
  const xmlDirectory = path.join(androidProjectRoot, 'app', 'src', 'main', 'res', 'xml');
  await fs.mkdir(xmlDirectory, { recursive: true });
  const oldFullBackup = await readRuleFile(
    xmlDirectory,
    getResourceName(references.fullBackupContent, FULL_BACKUP_RESOURCE),
  );
  const oldExtraction = await readRuleFile(
    xmlDirectory,
    getResourceName(references.dataExtractionRules, EXTRACTION_RESOURCE),
  );
  const fullBackup = createFullBackupContent(oldFullBackup);
  const extraction = createDataExtractionRules(oldExtraction);
  await Promise.all([
    fs.writeFile(path.join(xmlDirectory, `${FULL_BACKUP_RESOURCE}.xml`), fullBackup),
    fs.writeFile(path.join(xmlDirectory, `${EXTRACTION_RESOURCE}.xml`), extraction),
  ]);
}

function withPushStorageBackup(config) {
  config = withAndroidManifest(config, async (modConfig) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);
    if (process.env.AVISA_PREVIEW_ALLOW_CLEARTEXT_TRAFFIC === 'true') {
      mainApplication.$['android:usesCleartextTraffic'] = 'true';
    }
    const previousRules = {
      fullBackupContent: mainApplication.$['android:fullBackupContent'],
      dataExtractionRules: mainApplication.$['android:dataExtractionRules'],
    };
    await applyPushStorageBackupFiles(
      path.join(modConfig.modRequest.projectRoot, 'android'),
      previousRules,
    );
    mainApplication.$['android:fullBackupContent'] = `@xml/${FULL_BACKUP_RESOURCE}`;
    mainApplication.$['android:dataExtractionRules'] = `@xml/${EXTRACTION_RESOURCE}`;
    return modConfig;
  });
  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults = setIosStorageBackupExclusion(modConfig.modResults);
    return modConfig;
  });
  return config;
}

module.exports = Object.assign(withPushStorageBackup, {
  createDataExtractionRules,
  createFullBackupContent,
  setIosStorageBackupExclusion,
  applyPushStorageBackupFiles,
});
