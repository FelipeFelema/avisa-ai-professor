import {
  getSessionGeneration,
  invalidateSessionGeneration,
  isSessionGenerationCurrent,
} from '@/lib/session-generation';

describe('shared session generation', () => {
  it('invalidates synchronously and monotonically', () => {
    const previous = getSessionGeneration();

    expect(isSessionGenerationCurrent(previous)).toBe(true);
    const next = invalidateSessionGeneration();

    expect(next).toBe(previous + 1);
    expect(isSessionGenerationCurrent(previous)).toBe(false);
    expect(isSessionGenerationCurrent(next)).toBe(true);
  });
});
