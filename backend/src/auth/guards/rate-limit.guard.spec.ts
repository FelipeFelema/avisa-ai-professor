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
});
