import { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  beforeEach(() => {
    jest.useFakeTimers();
    guard = new RateLimitGuard();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reclaims expired IP buckets on traffic from a different IP', () => {
    const contextFor = (ip: string) =>
      ({
        switchToHttp: () => ({ getRequest: () => ({ ip }) }),
      }) as ExecutionContext;
    for (let i = 0; i < 1000; i++)
      guard.canActivate(contextFor(`synthetic-${i}`));
    jest.advanceTimersByTime(60_000);
    guard.canActivate(contextFor('new-client'));
    const buckets = (
      guard as unknown as { requestBuckets: Map<string, number[]> }
    ).requestBuckets;
    expect(buckets.size).toBe(1);
  });

  it('bounds IP cardinality and fails closed until expired buckets are reclaimed', () => {
    const contextFor = (ip: string) =>
      ({
        switchToHttp: () => ({ getRequest: () => ({ ip }) }),
      }) as ExecutionContext;
    for (let i = 0; i < 10_000; i++)
      guard.canActivate(contextFor(`synthetic-${i}`));
    expect(() => guard.canActivate(contextFor('overflow'))).toThrow();
    expect(guard.canActivate(contextFor('synthetic-0'))).toBe(true);
    jest.advanceTimersByTime(60_000);
    expect(guard.canActivate(contextFor('overflow'))).toBe(true);
  });

  it('allows requests until the configured limit and blocks the next one', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1' }),
      }),
    } as ExecutionContext;

    for (let index = 0; index < 10; index += 1) {
      expect(guard.canActivate(context)).toBe(true);
    }

    expect(() => guard.canActivate(context)).toThrow(
      'Muitas requisições. Tente novamente mais tarde.',
    );
  });

  it('shares the unchanged IP budget across push reads, registration and tests', () => {
    const contextFor = (method: string, path: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ ip: '127.0.0.1', method, path }),
        }),
      }) as ExecutionContext;
    for (let index = 0; index < 5; index += 1) {
      expect(
        guard.canActivate(contextFor('POST', '/push/installation/reserve')),
      ).toBe(true);
      expect(guard.canActivate(contextFor('PUT', '/push/installation'))).toBe(
        true,
      );
    }
    for (const [method, path] of [
      ['GET', '/push/installation'],
      ['POST', '/push/installation/reserve'],
      ['PUT', '/push/installation'],
      ['POST', '/push/installation/test'],
      ['DELETE', '/push/installation'],
    ]) {
      expect(() => guard.canActivate(contextFor(method, path))).toThrow(
        'Muitas requisições. Tente novamente mais tarde.',
      );
    }
    jest.advanceTimersByTime(60_000);
    expect(guard.canActivate(contextFor('GET', '/push/installation'))).toBe(
      true,
    );
  });
});
