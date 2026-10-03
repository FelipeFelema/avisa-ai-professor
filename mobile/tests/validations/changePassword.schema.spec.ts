import { changePasswordSchema } from '@/validations/changePassword.schema';

describe('changePasswordSchema exact shared policy', () => {
  const valid = {
    currentPassword: 'Synthetic old password',
    newPassword: 'Synthetic new password',
    confirmNewPassword: 'Synthetic new password',
  };
  it.each(['currentPassword', 'newPassword', 'confirmNewPassword'] as const)(
    'requires textual %s',
    (field) => {
      for (const value of ['', undefined, null, 123456, {}, []]) {
        expect(changePasswordSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
      }
    },
  );
  it.each([5, 6, 72, 73])('counts %i code points including multibyte passwords', (length) => {
    const password = '😀'.repeat(length);
    expect(
      changePasswordSchema.safeParse({
        ...valid,
        newPassword: password,
        confirmNewPassword: password,
      }).success,
    ).toBe(length >= 6 && length <= 72);
  });
  it('compares exactly without trim, case folding or Unicode normalization', () => {
    for (const password of ['  aBc  ', 'é'.repeat(6), ' '.repeat(6)]) {
      const result = changePasswordSchema.safeParse({
        ...valid,
        currentPassword: 'x'.repeat(100),
        newPassword: password,
        confirmNewPassword: password,
      });
      expect(result.success && result.data.newPassword === password).toBe(true);
      expect(
        changePasswordSchema.safeParse({
          ...valid,
          newPassword: password,
          confirmNewPassword: password + ' ',
        }).success,
      ).toBe(false);
    }
    expect(
      changePasswordSchema.safeParse({
        ...valid,
        newPassword: valid.currentPassword,
        confirmNewPassword: valid.currentPassword,
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        ...valid,
        confirmNewPassword: valid.newPassword.toUpperCase(),
      }).success,
    ).toBe(false);
  });
});
