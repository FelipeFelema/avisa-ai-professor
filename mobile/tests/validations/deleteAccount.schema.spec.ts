import {
  deleteAccountSchema,
  accountDeletionImpactSchema,
} from '@/validations/deleteAccount.schema';

describe('exact account confirmation parity', () => {
  const valid = { currentPassword: ' synthetic ', confirmationPhrase: 'EXCLUIR MINHA CONTA' };
  it.each([undefined, null, 1, false, [], {}, ''])('rejects password raw value %#', (value) => {
    expect(deleteAccountSchema.safeParse({ ...valid, currentPassword: value }).success).toBe(false);
  });
  it.each([
    undefined,
    null,
    1,
    true,
    [],
    {},
    '',
    'excluir minha conta',
    ' EXCLUIR MINHA CONTA',
    'EXCLUIR MINHA CONTA ',
    'EXCLUIR MINHA CONTA\n',
    'EXCLUIR  MINHA CONTA',
    'EXCLUIR MINHА CONTA',
  ])('rejects phrase raw value %#', (value) => {
    expect(deleteAccountSchema.safeParse({ ...valid, confirmationPhrase: value }).success).toBe(
      false,
    );
  });
  it.each([' ', 'a', '🔒'.repeat(200), 'é\u0301'.repeat(200)])(
    'keeps the existing credential unchanged %#',
    (value) => {
      expect(deleteAccountSchema.parse({ ...valid, currentPassword: value }).currentPassword).toBe(
        value,
      );
    },
  );
  it('rejects unknown fields and never retains credentials in errors', () => {
    const result = deleteAccountSchema.safeParse({ ...valid, id: 'other' });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain(valid.currentPassword);
  });
  const impact = {
    role: 'PARENT',
    canDelete: true,
    blockReason: null,
    ownedClassroomsCount: 0,
    announcementsInOwnedClassroomsCount: 0,
    externalMembershipsCount: 0,
    authoredAnnouncementsInOtherClassroomsCount: 0,
  };
  it('accepts the exact response and rejects inconsistent eligibility/types/extra data', () => {
    expect(accountDeletionImpactSchema.parse(impact)).toEqual(impact);
    for (const body of [
      { ...impact, id: 'other' },
      { ...impact, role: 'UNKNOWN' },
      { ...impact, canDelete: 'true' },
      { ...impact, ownedClassroomsCount: -1 },
      { ...impact, externalMembershipsCount: 1.5 },
      { ...impact, announcementsInOwnedClassroomsCount: '0' },
      { ...impact, blockReason: 'LAST_ADMIN_REQUIRED' },
      { ...impact, canDelete: false },
      { ...impact, role: 'PARENT', canDelete: false, blockReason: 'LAST_ADMIN_REQUIRED' },
    ]) {
      expect(accountDeletionImpactSchema.safeParse(body).success).toBe(false);
    }
    expect(
      accountDeletionImpactSchema.safeParse({
        ...impact,
        role: 'ADMIN',
        canDelete: false,
        blockReason: 'LAST_ADMIN_REQUIRED',
      }).success,
    ).toBe(true);
  });
});
