let sessionGeneration = 0;

export function getSessionGeneration(): number {
  return sessionGeneration;
}

export function invalidateSessionGeneration(): number {
  sessionGeneration += 1;
  return sessionGeneration;
}

export function isSessionGenerationCurrent(generation: number): boolean {
  return generation === sessionGeneration;
}

export class SessionGenerationChangedError extends Error {
  constructor() {
    super('A sessão mudou durante a operação.');
    this.name = 'SessionGenerationChangedError';
  }
}

export function assertSessionGeneration(generation: number): void {
  if (!isSessionGenerationCurrent(generation)) {
    throw new SessionGenerationChangedError();
  }
}

export function isSessionGenerationChangedError(error: unknown): boolean {
  return error instanceof SessionGenerationChangedError;
}

export interface PrivateRequestOptions {
  signal?: AbortSignal;
  sessionGeneration?: number;
}

export function normalizePrivateRequestOptions(
  options?: PrivateRequestOptions | AbortSignal,
): PrivateRequestOptions {
  if (!options) return {};
  if ('aborted' in options && 'addEventListener' in options) {
    return { signal: options as AbortSignal };
  }
  return options as PrivateRequestOptions;
}
