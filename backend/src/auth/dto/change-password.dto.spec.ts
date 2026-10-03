import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ChangePasswordDto } from './change-password.dto';

describe('ChangePasswordDto production conversion', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    validationError: { target: false, value: false },
  });
  const valid = {
    currentPassword: 'Synthetic old password',
    newPassword: 'Synthetic new password',
    confirmNewPassword: 'Synthetic new password',
  };
  const parse = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: ChangePasswordDto });

  it.each(['currentPassword', 'newPassword', 'confirmNewPassword'] as const)(
    'rejects nontextual and missing %s without leaking input',
    async (field) => {
      for (const value of [undefined, null, '', 123456, [], {}]) {
        let rejected = false;
        try {
          await parse({ ...valid, [field]: value });
        } catch {
          rejected = true;
        }
        expect(rejected).toBe(true);
      }
    },
  );
  it.each(['id', 'userId', 'role', 'sid', 'extra'])(
    'rejects forbidden %s',
    async (field) => {
      await expect(parse({ ...valid, [field]: 'untrusted' })).rejects.toThrow();
    },
  );
  it.each([5, 6, 72, 73])('counts %i Unicode code points', async (length) => {
    const password = '😀'.repeat(length);
    let accepted = false;
    try {
      await parse({
        ...valid,
        newPassword: password,
        confirmNewPassword: password,
      });
      accepted = true;
    } catch {
      /* boolean assertions protect synthetic inputs */
    }
    expect(accepted).toBe(length >= 6 && length <= 72);
  });
  it('preserves exact strings, significant whitespace and an unrestricted current password', async () => {
    const body = {
      currentPassword: 'x'.repeat(100),
      newPassword: '  aBc é  ',
      confirmNewPassword: '  aBc é  ',
    };
    const parsed = (await parse(body)) as ChangePasswordDto;
    expect(
      Object.keys(body).every(
        (key) =>
          parsed[key as keyof ChangePasswordDto] ===
          body[key as keyof typeof body],
      ),
    ).toBe(true);
    for (const [request, message] of [
      [
        { ...valid, confirmNewPassword: valid.newPassword.toUpperCase() },
        'PASSWORD_CONFIRMATION_MISMATCH',
      ],
      [
        {
          ...valid,
          newPassword: valid.currentPassword,
          confirmNewPassword: valid.currentPassword,
        },
        'PASSWORD_UNCHANGED',
      ],
    ] as const) {
      let matched = false;
      try {
        await parse(request);
      } catch (error) {
        if (error instanceof BadRequestException)
          matched = (
            error.getResponse() as { message: string[] }
          ).message.includes(message);
      }
      expect(matched).toBe(true);
    }
  });
});
