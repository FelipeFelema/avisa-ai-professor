import { runtimeConnectionString } from './runtime-connection-string';

describe('runtime PostgreSQL connection string', () => {
  const base = 'postgresql://user:p%40ss%26word@database.invalid/db';

  it.each([
    ['sslmode=require', 'sslmode=verify-full'],
    [
      'channel_binding=require&sslmode=require&connect_timeout=10',
      'channel_binding=require&sslmode=verify-full&connect_timeout=10',
    ],
    [
      'schema=public&sslmode=require&application_name=a%20b&empty=&flag',
      'schema=public&sslmode=verify-full&application_name=a%20b&empty=&flag',
    ],
    ['sslmode=require&sslmode=disable', 'sslmode=verify-full&sslmode=disable'],
    ['sslmode=verify-full', 'sslmode=verify-full'],
    ['sslmode=disable', 'sslmode=disable'],
    ['sslmode=prefer', 'sslmode=prefer'],
    [
      'other_sslmode=require&value=sslmode%3Drequire',
      'other_sslmode=require&value=sslmode%3Drequire',
    ],
    ['sslmode=require-extra', 'sslmode=require-extra'],
  ])('preserves unrelated bytes for %s', (query, expected) => {
    expect(runtimeConnectionString(`${base}?${query}`)).toBe(
      `${base}?${expected}`,
    );
  });

  it('preserves fragments and does not normalize text inside them', () => {
    expect(
      runtimeConnectionString(`${base}?sslmode=require#&sslmode=require`),
    ).toBe(`${base}?sslmode=verify-full#&sslmode=require`);
    expect(runtimeConnectionString(`${base}#?sslmode=require`)).toBe(
      `${base}#?sslmode=require`,
    );
  });

  it('leaves URLs without an explicit TLS mode unchanged', () => {
    expect(runtimeConnectionString(base)).toBe(base);
    expect(runtimeConnectionString(`${base}?schema=public`)).toBe(
      `${base}?schema=public`,
    );
  });
});
