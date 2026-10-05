import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';
import { CreateInviteCodeDto } from './create-invite-code.dto';

describe('CreateInviteCodeDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  it('accepts exactly the PROFESSOR role string', async () => {
    await expect(
      pipe.transform(
        { role: 'PROFESSOR' },
        { type: 'body', metatype: CreateInviteCodeDto },
      ),
    ).resolves.toMatchObject({ role: 'PROFESSOR' });
  });

  it.each([
    ['missing', {}],
    ['null', { role: null }],
    ['number', { role: 3 }],
    ['boolean', { role: true }],
    ['array', { role: [] }],
    ['object', { role: {} }],
    ['ADMIN', { role: 'ADMIN' }],
    ['PARENT', { role: 'PARENT' }],
    ['extra lifetime', { role: 'PROFESSOR', expiresInDays: 7 }],
    ['extra code', { role: 'PROFESSOR', code: 'SENTINEL' }],
  ])('rejects %s without echoing submitted values', async (_label, body) => {
    const dto = plainToInstance(CreateInviteCodeDto, body);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(
      JSON.stringify(
        errors.map(({ property, constraints }) => ({ property, constraints })),
      ),
    ).not.toContain('SENTINEL');
    await expect(
      pipe.transform(body, { type: 'body', metatype: CreateInviteCodeDto }),
    ).rejects.toThrow();
  });

  it.each([null, [], 'not-an-object', 12])(
    'rejects a non-object body (%p)',
    async (body) => {
      await expect(
        pipe.transform(body, {
          type: 'body',
          metatype: CreateInviteCodeDto,
        }),
      ).rejects.toThrow();
    },
  );
});
