import {
  randomBytes,
  scrypt as deriveScrypt,
  timingSafeEqual,
} from 'node:crypto';
import * as bcrypt from 'bcrypt';

const SCRYPT_VERSION = 'v=1';
const SCRYPT_COST = 'N=32768,r=8,p=3';
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const SCRYPT_OPTIONS = {
  N: 32_768,
  r: 8,
  p: 3,
  maxmem: 64 * 1024 * 1024,
};
const MIN_BCRYPT_COST = 4;
const MAX_BCRYPT_COST = 14;

type ParsedScryptHash = { salt: Buffer; key: Buffer };

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      deriveScrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
        if (error) {
          reject(new Error('Password derivation failed.'));
          return;
        }

        resolve(key as Buffer);
      });
    } catch {
      reject(new Error('Password derivation failed.'));
    }
  });
}

function decodeBase64Url(value: string, expectedLength: number): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

  const decoded = Buffer.from(value, 'base64url');
  if (
    decoded.length !== expectedLength ||
    decoded.toString('base64url') !== value
  ) {
    return null;
  }

  return decoded;
}

function parseScryptHash(encoded: string): ParsedScryptHash | null {
  const parts = encoded.split('$');
  if (
    parts.length !== 6 ||
    parts[0] !== '' ||
    parts[1] !== 'scrypt' ||
    parts[2] !== SCRYPT_VERSION ||
    parts[3] !== SCRYPT_COST
  ) {
    return null;
  }

  const salt = decodeBase64Url(parts[4], SALT_LENGTH);
  const key = decodeBase64Url(parts[5], KEY_LENGTH);
  if (!salt || !key) return null;

  return { salt, key };
}

function hasSupportedBcryptCost(encoded: string): boolean {
  const match = /^\$2[abxy]\$(\d{2})\$[./A-Za-z0-9]{53}$/.exec(encoded);
  if (!match) return false;

  const cost = Number(match[1]);
  return cost >= MIN_BCRYPT_COST && cost <= MAX_BCRYPT_COST;
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string') {
    throw new TypeError('Password must be a string.');
  }

  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt);
  return `$scrypt$${SCRYPT_VERSION}$${SCRYPT_COST}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (typeof password !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  if (storedHash.startsWith('$scrypt$')) {
    const parsed = parseScryptHash(storedHash);
    if (!parsed) return false;

    try {
      const candidate = await deriveKey(password, parsed.salt);
      return timingSafeEqual(candidate, parsed.key);
    } catch {
      return false;
    }
  }

  if (!hasSupportedBcryptCost(storedHash)) return false;

  try {
    return await bcrypt.compare(password, storedHash);
  } catch {
    return false;
  }
}
