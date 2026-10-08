import { assertReleaseTestDatabase } from './helpers/release-security.fixture';

describe('Release assessment destination guard', () => {
  it('accepts only the exact isolated local database', () => {
    expect(
      assertReleaseTestDatabase(
        'postgresql://synthetic:synthetic@localhost:5432/avisa_ai_test',
      ).pathname,
    ).toBe('/avisa_ai_test');
  });
  it.each([
    'postgresql://synthetic:synthetic@localhost:5432/avisa_ai',
    'postgresql://synthetic:synthetic@localhost:5432/other_test',
    'postgresql://synthetic:synthetic@remote.invalid:5432/avisa_ai_test',
    'postgresql://synthetic:synthetic@localhost:5432/avisa_ai_test_copy',
    'mysql://synthetic:synthetic@localhost:5432/avisa_ai_test',
  ])('rejects unsafe destinations without connecting (%s)', (connection) => {
    expect(() => assertReleaseTestDatabase(connection)).toThrow();
  });
});
