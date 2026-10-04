import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DeleteAccountDto } from './delete-account.dto';

describe('DeleteAccountRequest raw JSON boundary', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const validate = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: DeleteAccountDto });
  const valid = {
    currentPassword: ' synthetic password ',
    confirmationPhrase: 'EXCLUIR MINHA CONTA',
  };
  it.each([undefined, null, 123, true, [], {}, ['password']])(
    'rejects nonstring password %#',
    async (value) => {
      await expect(
        validate({ ...valid, currentPassword: value }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
  it.each([
    undefined,
    null,
    123,
    false,
    [],
    {},
    '',
    'excluir minha conta',
    ' EXCLUIR MINHA CONTA',
    'EXCLUIR MINHA CONTA ',
    'EXCLUIR MINHA CONTA\n',
    'EXCLUIR  MINHA CONTA',
    'EXCLUIR MINHА CONTA',
  ])('requires exact phrase %#', async (value) => {
    await expect(
      validate({ ...valid, confirmationPhrase: value }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each(['', null])('rejects empty credentials %#', async (value) => {
    await expect(
      validate({ ...valid, currentPassword: value }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each([' ', 'a', '🔒'.repeat(200), 'é\u0301'.repeat(200)])(
    'preserves existing credentials %# without a new limit',
    async (password) => {
      expect(await validate({ ...valid, currentPassword: password })).toEqual({
        ...valid,
        currentPassword: password,
      });
    },
  );
  it('rejects extras without leaking the submitted values', async () => {
    const secret = 'SYNTHETIC_VALUE_MUST_NOT_APPEAR';
    let error: unknown;
    try {
      await validate({
        currentPassword: secret,
        confirmationPhrase: secret,
        userId: secret,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(BadRequestException);
    expect(
      JSON.stringify((error as BadRequestException).getResponse()).includes(
        secret,
      ),
    ).toBe(false);
  });
});
