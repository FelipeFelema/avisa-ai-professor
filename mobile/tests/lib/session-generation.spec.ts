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

  it('discards an asynchronous callback captured by an invalidated session', async () => {
    let resolveResult!: () => void;
    const applyResult = jest.fn();
    const generation = getSessionGeneration();
    const delayedResult = new Promise<void>((resolve) => {
      resolveResult = resolve;
    });
    const callback = delayedResult.then(() => {
      if (isSessionGenerationCurrent(generation)) applyResult();
    });

    invalidateSessionGeneration();
    resolveResult();
    await callback;

    expect(applyResult).not.toHaveBeenCalled();
  });
});
