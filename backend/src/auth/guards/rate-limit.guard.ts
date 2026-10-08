import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly MAX_REQUESTS = 10;
  private static readonly WINDOW_MS = 60_000;
  private static readonly MAX_BUCKETS = 10_000;

  private readonly requestBuckets = new Map<string, number[]>();
  private nextSweepAt = 0;

  canActivate(context: ExecutionContext): boolean {
    const httpContext = context.switchToHttp() as {
      getRequest: () => { ip?: string };
    };
    const request = httpContext.getRequest();
    const ip = request.ip ?? 'unknown';
    const now = Date.now();
    if (now >= this.nextSweepAt) {
      for (const [key, timestamps] of this.requestBuckets) {
        const active = timestamps.filter(
          (timestamp) => now - timestamp < RateLimitGuard.WINDOW_MS,
        );
        if (active.length) this.requestBuckets.set(key, active);
        else this.requestBuckets.delete(key);
      }
      this.nextSweepAt = now + RateLimitGuard.WINDOW_MS;
    }
    if (
      !this.requestBuckets.has(ip) &&
      this.requestBuckets.size >= RateLimitGuard.MAX_BUCKETS
    ) {
      throw new HttpException(
        'Muitas requisições. Tente novamente mais tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const bucket = this.requestBuckets.get(ip) ?? [];
    const validRequests = bucket.filter(
      (timestamp) => now - timestamp < RateLimitGuard.WINDOW_MS,
    );

    if (validRequests.length >= RateLimitGuard.MAX_REQUESTS) {
      throw new HttpException(
        'Muitas requisições. Tente novamente mais tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    validRequests.push(now);

    this.requestBuckets.set(ip, validRequests);

    return true;
  }
}
