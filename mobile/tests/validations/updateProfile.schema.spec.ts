import { buildUpdateProfilePayload, updateProfileSchema } from '@/validations/updateProfile.schema';

describe('update profile schema', () => {
  it('trims the name and trims/lowercases the email while preserving accents', () => {
    const result = updateProfileSchema.parse({
      name: "  João D'Ávila-Silva  ",
      email: '  Joao.Davila@Example.COM  ',
    });

    expect(result).toEqual({
      name: "João D'Ávila-Silva",
      email: 'joao.davila@example.com',
    });
  });

  it.each([
    ['blank after trim', '   '],
    ['shorter than three characters', 'Jo'],
    ['longer than one hundred characters', 'A'.repeat(101)],
    ['containing a number', 'João 2'],
  ])('rejects a name that is %s', (_reason, name) => {
    const result = updateProfileSchema.safeParse({
      name,
      email: 'user@example.com',
    });

    expect(result.success).toBe(false);
  });

  it('accepts the three-character and one-hundred-character name limits', () => {
    expect(
      updateProfileSchema.safeParse({
        name: 'Ana',
        email: 'user@example.com',
      }).success,
    ).toBe(true);
    expect(
      updateProfileSchema.safeParse({
        name: 'A'.repeat(100),
        email: 'user@example.com',
      }).success,
    ).toBe(true);
  });

  it('accepts an email at the 255-character limit and rejects one character over it', () => {
    const domainAtLimit = `${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`;
    const emailAtLimit = `${'a'.repeat(64)}@${domainAtLimit}`;

    expect(emailAtLimit).toHaveLength(255);
    expect(
      updateProfileSchema.safeParse({
        name: 'Ana',
        email: emailAtLimit,
      }).success,
    ).toBe(true);
    expect(
      updateProfileSchema.safeParse({
        name: 'Ana',
        email: `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}`,
      }).success,
    ).toBe(false);
  });

  describe('changed-only payload', () => {
    const currentProfile = {
      name: "João D'Ávila",
      email: 'joao@example.com',
    };

    it('returns only normalized fields whose effective value changed', () => {
      expect(
        buildUpdateProfilePayload(currentProfile, {
          name: "  João D'Ávila-Silva  ",
          email: ' JOAO@EXAMPLE.COM ',
        }),
      ).toEqual({
        name: "João D'Ávila-Silva",
      });
    });

    it('returns an empty payload for a normalized no-op', () => {
      expect(
        buildUpdateProfilePayload(currentProfile, {
          name: " João D'Ávila ",
          email: ' JOAO@EXAMPLE.COM ',
        }),
      ).toEqual({});
    });
  });
});
