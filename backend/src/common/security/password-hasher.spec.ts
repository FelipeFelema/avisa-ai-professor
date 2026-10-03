import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { hashPassword, verifyPassword } from './password-hasher';

describe('password hasher', () => {
  it.each(['throw', 'callback'])(
    'sanitizes %s derivation failures without fallback or logging',
    async (mode) => {
      const password = 'Synthetic derivation failure input';
      const stored = await hashPassword(password);
      const derive = jest
        .spyOn(crypto, 'scrypt')
        .mockImplementation((_password, _salt, _keylen, _options, callback) => {
          const error = new Error(`Synthetic allocation failure: ${password}`);
          if (mode === 'throw') throw error;
          callback(error, Buffer.alloc(0));
        });
      const fallback = jest.spyOn(bcrypt, 'compare');
      const diagnostics = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        let failure: unknown;
        try {
          await hashPassword(password);
        } catch (error) {
          failure = error;
        }
        expect(
          failure instanceof Error &&
            failure.message === 'Password derivation failed.' &&
            !('cause' in failure),
        ).toBe(true);
        expect(await verifyPassword(password, stored)).toBe(false);
        expect(fallback).not.toHaveBeenCalled();
        expect(diagnostics).not.toHaveBeenCalled();
      } finally {
        derive.mockRestore();
        fallback.mockRestore();
        diagnostics.mockRestore();
      }
    },
  );
  it('stores scrypt v1 with a fresh salt and verifies the complete password', async () => {
    const password = 'Synthetic scrypt password';
    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash.startsWith('$scrypt$v=1$N=32768,r=8,p=3$')).toBe(true);
    expect(firstHash === secondHash).toBe(false);
    expect(await verifyPassword(password, firstHash)).toBe(true);
    expect(await verifyPassword('Synthetic scrypt Password', firstHash)).toBe(
      false,
    );
  });

  it('preserves significant spaces and letter case', async () => {
    const password = '  Case-sensitive value  ';
    const hash = await hashPassword(password);

    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword(password.trim(), hash)).toBe(false);
    expect(await verifyPassword('  case-sensitive value  ', hash)).toBe(false);
  });

  it('continues to verify legacy bcrypt credentials', async () => {
    const password = 'Synthetic legacy password';
    const legacyHash = await bcrypt.hash(password, 10);

    expect(await verifyPassword(password, legacyHash)).toBe(true);
    expect(await verifyPassword('Synthetic legacy Password', legacyHash)).toBe(
      false,
    );
  });

  it('distinguishes valid Unicode passwords with the same first 72 bytes', async () => {
    const sharedPrefix = `${'é'.repeat(36)}${'a'.repeat(35)}`;
    const password = `${sharedPrefix}x`;
    const otherPassword = `${sharedPrefix}y`;
    const hash = await hashPassword(password);

    expect(Array.from(password).length).toBe(72);
    expect(Buffer.byteLength(password, 'utf8')).toBeGreaterThan(72);
    expect(
      Buffer.from(password)
        .subarray(0, 72)
        .equals(Buffer.from(otherPassword).subarray(0, 72)),
    ).toBe(true);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword(otherPassword, hash)).toBe(false);
  });

  it('rejects malformed, unsupported and unsafe-cost encodings without diagnostics', async () => {
    const password = 'Synthetic verification input';
    const validHash = await hashPassword(password);
    const [, , , , salt, key] = validHash.split('$');
    const malformedHashes = [
      '$scrypt$v=2$N=32768,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      '$scrypt$v=1$N=65536,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      '$scrypt$v=1$N=32768,r=8,p=3$AAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      `$scrypt$v=1$N=32768,r=8,p=3$${salt}$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
      `$scrypt$v=1$N=32768,r=8,p=3$${salt}!$${key}`,
      `$2b$31$${'A'.repeat(53)}`,
      'not-a-password-hash',
    ];
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const results = await Promise.all(
        malformedHashes.map((malformedHash) =>
          verifyPassword(password, malformedHash),
        ),
      );

      expect(results.every((result) => result === false)).toBe(true);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
