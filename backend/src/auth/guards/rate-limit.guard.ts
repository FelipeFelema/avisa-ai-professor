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

  private readonly requestBuckets = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const httpContext = context.switchToHttp() as {
      getRequest: () => { ip?: string };
    };
    const request = httpContext.getRequest();
    const ip = request.ip ?? 'unknown';
    const now = Date.now();
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

    if (validRequests.length === 0) {
      this.requestBuckets.delete(ip);
    } else {
      this.requestBuckets.set(ip, validRequests);
    }

    return true;
  }
}
