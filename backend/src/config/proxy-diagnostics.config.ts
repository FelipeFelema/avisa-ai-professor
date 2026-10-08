// TEMPORARY SEC-013: remove after the approved production collection.
export function proxyDiagnosticsKey(
  env: NodeJS.ProcessEnv,
): Buffer | undefined {
  const flag = env.SEC013_PROXY_DIAGNOSTICS;
  if (flag !== undefined && flag !== 'false' && flag !== 'true') {
    throw new Error('SEC013_DIAGNOSTICS_CONFIG_INVALID:ENABLE_FLAG');
  }
  if (flag !== 'true') return undefined;
  const key = env.SEC013_PROXY_DIAGNOSTICS_HMAC_KEY;
  if (
    !key ||
    !/^[a-f0-9]{64}$/i.test(key) ||
    new Set(key.toLowerCase()).size < 12
  ) {
    throw new Error('SEC013_DIAGNOSTICS_CONFIG_INVALID:HMAC_KEY');
  }
  return Buffer.from(key, 'hex');
}
