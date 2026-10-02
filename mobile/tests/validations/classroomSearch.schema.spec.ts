import { classroomSearchSchema } from '@/validations/classroomSearch.schema';

describe('classroom search schema', () => {
  it('trims external whitespace and preserves internal text exactly', () => {
    expect(classroomSearchSchema.parse('  Matemática  6º A!  ')).toBe('Matemática  6º A!');
  });

  it('accepts empty and whitespace-only searches as the unfiltered criterion', () => {
    expect(classroomSearchSchema.parse('')).toBe('');
    expect(classroomSearchSchema.parse('   \t  ')).toBe('');
  });

  it('accepts 80 normalized code points, including surrogate pairs and combining marks', () => {
    expect(classroomSearchSchema.safeParse(`  ${'😀'.repeat(80)}  `).success).toBe(true);
    expect(classroomSearchSchema.safeParse('e\u0301'.repeat(40)).success).toBe(true);
  });

  it('Mais de 80 pontos de código normalizados bloqueia query. Vazio é válido.', () => {
    const raw = `  ${'😀'.repeat(81)}  `;
    const result = classroomSearchSchema.safeParse(raw);

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('Use até 80 caracteres na pesquisa');
    expect(raw).toHaveLength(166);
  });

  it('preserves case, accents, numbers, punctuation, and internal spaces', () => {
    const value = '  Matemática 6º A / Grupo_%  ';

    expect(classroomSearchSchema.parse(value)).toBe('Matemática 6º A / Grupo_%');
    expect(classroomSearchSchema.parse('matematica')).toBe('matematica');
  });
});
