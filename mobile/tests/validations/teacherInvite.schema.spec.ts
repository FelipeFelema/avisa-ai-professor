import { randomUUID } from 'node:crypto';
import { parseTeacherInviteResponse } from '@/validations/teacherInvite.schema';

describe('teacher invite response validation', () => {
  const createdAt = '2026-10-04T12:00:00.123Z';
  const valid = {
    id: randomUUID(),
    code: `PROF-${'A'.repeat(32)}`,
    role: 'PROFESSOR',
    isActive: true,
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + 604_800_000).toISOString(),
    updatedAt: '2026-10-04T12:00:00.123Z',
  };

  it('accepts required metadata and the exact seven-day UTC lifetime', () => {
    expect(parseTeacherInviteResponse(valid)).toEqual({ success: true, data: valid });
  });

  it.each(['id', 'code', 'role', 'isActive', 'createdAt', 'expiresAt', 'updatedAt'])(
    'rejects a response missing %s',
    (field) => {
      const missing = { ...valid };
      delete missing[field as keyof typeof missing];
      expect(parseTeacherInviteResponse(missing)).toEqual({ success: false });
    },
  );

  it.each([
    ['UUID', { id: 'not-a-uuid' }],
    ['code prefix', { code: `TEACHER-${'A'.repeat(32)}` }],
    ['uppercase hex code', { code: `PROF-${'a'.repeat(32)}` }],
    ['role', { role: 'ADMIN' }],
    ['active state', { isActive: false }],
    ['creation timestamp', { createdAt: '2026-10-04T12:00:00Z' }],
    ['expiry timestamp', { expiresAt: '2026-10-11T12:00:00-03:00' }],
    ['updated timestamp', { updatedAt: 'yesterday' }],
    ['expiry delta', { expiresAt: '2026-10-11T12:00:01.123Z' }],
    ['extra metadata', { secret: 'sentinel-secret' }],
  ])('rejects incompatible %s without returning raw issues or input', (_label, change) => {
    const result = parseTeacherInviteResponse({ ...valid, ...change });
    expect(result).toEqual({ success: false });
    expect(JSON.stringify(result)).not.toContain(valid.code);
    expect(JSON.stringify(result)).not.toContain('sentinel-secret');
  });
});
