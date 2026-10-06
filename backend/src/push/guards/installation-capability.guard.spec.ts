import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InstallationCapabilityGuard,
  compareCapabilityHash,
  decodeCapabilityHeader,
} from './installation-capability.guard';

const installationId = '00000000-0000-4000-8000-000000000010';
const capabilityBytes = Buffer.alloc(32, 23);
const capability = capabilityBytes.toString('base64url');
const storedHash = createHash('sha256').update(capabilityBytes).digest('hex');

function makeContext(headers: Record<string, string | string[] | undefined>) {
  const request: { headers: typeof headers; pushInstallationId?: string } = {
    headers,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('InstallationCapabilityGuard', () => {
  let guard: InstallationCapabilityGuard;
  let findUnique: jest.Mock;

  beforeEach(() => {
    findUnique = jest.fn();
    guard = new InstallationCapabilityGuard({
      pushInstallation: { findUnique },
    } as unknown as PrismaService);
  });

  it.each([
    {},
    { 'x-push-installation': installationId },
    { 'x-push-capability': capability },
    {
      'x-push-installation': 'not-a-uuid',
      'x-push-capability': capability,
    },
    {
      'x-push-installation': installationId,
      'x-push-capability': `${capability}=`,
    },
    {
      'x-push-installation': installationId,
      'x-push-capability': ['A'.repeat(43), 'B'.repeat(43)],
    },
  ])(
    'rejects absent or malformed proof headers without exposing them',
    async (headers) => {
      const { context } = makeContext(headers);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(findUnique).not.toHaveBeenCalled();
    },
  );

  it('checks header length before attempting base64 decoding', () => {
    const decoder = jest.spyOn(Buffer, 'from');

    try {
      expect(() => decodeCapabilityHeader('A'.repeat(4096))).toThrow(
        BadRequestException,
      );
      expect(decoder).not.toHaveBeenCalled();
    } finally {
      decoder.mockRestore();
    }
  });

  it('requires exactly 32 decoded bytes and canonical base64url encoding', () => {
    expect(() =>
      decodeCapabilityHeader(Buffer.alloc(31).toString('base64url')),
    ).toThrow(BadRequestException);
    expect(() => decodeCapabilityHeader(`${'A'.repeat(42)}B`)).toThrow(
      BadRequestException,
    );
  });

  it('compares equal-length hashes with a safe false result for mismatches', () => {
    expect(compareCapabilityHash(storedHash, storedHash)).toBe(true);
    expect(compareCapabilityHash(storedHash, '0'.repeat(64))).toBe(false);
    expect(compareCapabilityHash(storedHash, 'short')).toBe(false);
  });

  it('accepts a valid capability and attaches only the installation identifier', async () => {
    findUnique.mockResolvedValue({
      id: installationId,
      secretHash: storedHash,
    });
    const { context, request } = makeContext({
      'x-push-installation': installationId,
      'x-push-capability': capability,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.pushInstallationId).toBe(installationId);
    expect(request).not.toHaveProperty('pushCapabilityHash');
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: installationId },
      select: { id: true, secretHash: true },
    });
  });

  it('returns one generic forbidden error for an unknown installation or wrong secret', async () => {
    findUnique.mockResolvedValue({
      id: installationId,
      secretHash: '0'.repeat(64),
    });
    const { context } = makeContext({
      'x-push-installation': installationId,
      'x-push-capability': capability,
    });

    try {
      await guard.canActivate(context);
      throw new Error('expected proof verification to reject the request');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as Error).message).toBe('PUSH_INSTALLATION_PROOF_INVALID');
      expect((error as Error).message).not.toContain(installationId);
      expect((error as Error).message).not.toContain(capability);
    }
  });
});
