import { trustedProxyCidrs } from './trusted-proxy.config';

describe('trustedProxyCidrs', () => {
  it('defaults to refusing all forwarded identities', () => {
    expect(trustedProxyCidrs({})).toBe(false);
  });

  it('accepts explicit IPv4/IPv6 addresses and CIDRs, trimming and deduplicating', () => {
    expect(
      trustedProxyCidrs({
        TRUST_PROXY_CIDRS:
          ' 192.0.2.1,192.0.2.0/24,2001:db8::/32,::1/128,192.0.2.1 ',
      }),
    ).toEqual(['192.0.2.1', '192.0.2.0/24', '2001:db8::/32', '::1/128']);
  });

  it.each([
    '',
    ' ',
    'true',
    'false',
    '1',
    '*',
    'localhost',
    'loopback',
    'fe80::1%eth0/64',
    '0.0.0.0/0',
    '::/0',
    '0.0.0.0/1',
    '::/8',
    '::/16',
    '::ffff:0.0.0.0/96',
    '0:0:0:0:0:ffff:0:0/96',
    '::ffff:128.0.0.0/97',
    '::ffff:192.0.2.1',
    '192.0.2.0/33',
    '2001:db8::/129',
    '192.0.2.0/024',
    '192.0.2.1/',
    '192.0.2.1/24/32',
    '192.0.2.1,',
    '192.0.2.1,,192.0.2.2',
    Array.from({ length: 33 }, (_, i) => `192.0.2.${i}`).join(','),
    'x'.repeat(4097),
  ])(
    'rejects invalid settings without echoing their contents (case %#)',
    (setting) => {
      expect(() => trustedProxyCidrs({ TRUST_PROXY_CIDRS: setting })).toThrow(
        'PRODUCTION_CONFIG_INVALID:TRUST_PROXY_CIDRS',
      );
    },
  );
});
