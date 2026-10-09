import { PrismaService } from './prisma.service';

const mockAdapterConfig = jest.fn();

jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));
jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class {
    constructor(config: unknown) {
      mockAdapterConfig(config);
    }
  },
}));

describe('PrismaService runtime TLS configuration', () => {
  const previous = process.env.DATABASE_URL;
  afterEach(() => {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    mockAdapterConfig.mockClear();
  });

  it('normalizes only the adapter URL without changing the CLI environment', () => {
    const original =
      'postgresql://user:p%40ss@database.invalid/db?sslmode=require&channel_binding=require&schema=public';
    process.env.DATABASE_URL = original;

    new PrismaService();

    expect(mockAdapterConfig).toHaveBeenCalledWith({
      connectionString: original.replace(
        'sslmode=require',
        'sslmode=verify-full',
      ),
    });
    expect(process.env.DATABASE_URL).toBe(original);
  });

  it('reports a missing URL without echoing configuration', () => {
    delete process.env.DATABASE_URL;
    expect(() => new PrismaService()).toThrow(
      'DATABASE_URL environment variable is required for Prisma.',
    );
    expect(mockAdapterConfig).not.toHaveBeenCalled();
  });
});
