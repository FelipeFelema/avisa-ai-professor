import { BlockList, isIP } from 'node:net';

/** Only operator-supplied proxy addresses; never trust arbitrary headers/hops. */
export function trustedProxyCidrs(
  env: NodeJS.ProcessEnv = process.env,
): false | string[] {
  const configured = env.TRUST_PROXY_CIDRS;
  if (configured === undefined) return false;
  const fail = (): never => {
    throw new Error('PRODUCTION_CONFIG_INVALID:TRUST_PROXY_CIDRS');
  };
  if (!configured.trim() || configured.length > 4096) return fail();
  const entries = configured.split(',').map((entry) => entry.trim());
  if (entries.length > 32) return fail();
  for (const entry of entries) {
    const parts = entry.split('/');
    const family = isIP(parts[0]);
    if (!family || parts.length > 2 || entry.includes('%')) return fail();
    // Require native IPv4 notation for mapped peers, so IPv6 prefixes cannot
    // conceal an excessively broad effective IPv4 range.
    if (
      family === 6 &&
      new URL(`http://[${parts[0]}]`).hostname.startsWith('[::ffff:')
    )
      return fail();
    if (parts.length === 2) {
      if (!/^[1-9]\d{0,2}$/.test(parts[1])) return fail();
      const prefix = Number(parts[1]);
      // Exclude universal and excessively broad trust ranges.
      if (
        prefix < (family === 4 ? 8 : 16) ||
        prefix > (family === 4 ? 32 : 128)
      )
        return fail();
      if (family === 6) {
        const subnet = new BlockList();
        subnet.addSubnet(parts[0], prefix, 'ipv6');
        // A bounded IPv6 subnet can still trust every mapped IPv4 peer.
        if (
          subnet.check('::ffff:0.0.0.0', 'ipv6') &&
          subnet.check('::ffff:255.255.255.255', 'ipv6')
        )
          return fail();
      }
    }
  }
  return [...new Set(entries)];
}
