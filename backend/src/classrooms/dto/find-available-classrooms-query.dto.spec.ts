import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { FindAvailableClassroomsQueryDto } from './find-available-classrooms-query.dto';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

function transformQuery(value: Record<string, unknown>) {
  return validationPipe.transform(value, {
    type: 'query',
    metatype: FindAvailableClassroomsQueryDto,
  }) as Promise<FindAvailableClassroomsQueryDto>;
}

async function validationMessages(value: Record<string, unknown>) {
  try {
    await transformQuery(value);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse() as {
      message: string[];
    };
    return response.message;
  }

  throw new Error('Expected the classroom search query to be rejected.');
}

describe('FindAvailableClassroomsQueryDto', () => {
  it('accepts an absent search and normalizes empty or whitespace-only values', async () => {
    await expect(transformQuery({})).resolves.toMatchObject({
      search: undefined,
    });
    await expect(transformQuery({ search: '' })).resolves.toMatchObject({
      search: '',
    });
    await expect(transformQuery({ search: '   \t  ' })).resolves.toMatchObject({
      search: '',
    });
  });

  it('trims only external whitespace and preserves internal characters', async () => {
    await expect(
      transformQuery({ search: '  Matemática  6º A  ' }),
    ).resolves.toMatchObject({ search: 'Matemática  6º A' });
  });

  it('counts code points after trimming, including surrogate pairs and combining sequences', async () => {
    const emojiAtLimit = `  ${'😀'.repeat(80)}  `;
    const emojiOverLimit = ` ${'😀'.repeat(81)} `;
    const combiningAtLimit = 'e\u0301'.repeat(40);
    const combiningOverLimit = 'e\u0301'.repeat(41);

    await expect(
      transformQuery({ search: emojiAtLimit }),
    ).resolves.toMatchObject({
      search: '😀'.repeat(80),
    });
    await expect(
      transformQuery({ search: combiningAtLimit }),
    ).resolves.toMatchObject({
      search: combiningAtLimit,
    });

    expect(await validationMessages({ search: emojiOverLimit })).toContain(
      'A pesquisa deve ter no máximo 80 pontos de código Unicode após o trim.',
    );
    expect(await validationMessages({ search: combiningOverLimit })).toContain(
      'A pesquisa deve ter no máximo 80 pontos de código Unicode após o trim.',
    );
  });

  it('accepts exactly 80 normalized code points and rejects 81', async () => {
    await expect(
      transformQuery({ search: `  ${'A'.repeat(80)}  ` }),
    ).resolves.toMatchObject({ search: 'A'.repeat(80) });

    expect(await validationMessages({ search: 'A'.repeat(81) })).toContain(
      'A pesquisa deve ter no máximo 80 pontos de código Unicode após o trim.',
    );
  });

  it.each([
    ['null', null],
    ['number', 42],
    ['boolean', true],
    ['array', ['matemática', 'português']],
    ['object', { term: 'matemática' }],
  ])(
    'rejects a non-textual %s without implicit conversion',
    async (_label, search) => {
      expect(await validationMessages({ search })).toContain(
        'Valores não textuais ou múltiplos são inválidos na fronteira HTTP.',
      );
    },
  );
});
