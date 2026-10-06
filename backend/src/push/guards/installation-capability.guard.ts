import { createHash, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PushInstallationHeadersDto } from '../dto/push-installation-headers.dto';
import { validatePushDto } from '../dto/push-request.validation';

const INVALID_PUSH_REQUEST = 'PUSH_INVALID_REQUEST';
const INVALID_INSTALLATION_PROOF = 'PUSH_INSTALLATION_PROOF_INVALID';
const PUSH_OPERATION_FAILED = 'PUSH_OPERATION_FAILED';
const CAPABILITY_BYTES = 32;
const CAPABILITY_HEADER_LENGTH = 43;
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

interface PushGuardRequest extends Request {
  pushInstallationId?: string;
}

export function decodeCapabilityHeader(value: string): Buffer {
  if (
    typeof value !== 'string' ||
    value.length !== CAPABILITY_HEADER_LENGTH ||
    !BASE64_URL_PATTERN.test(value)
  ) {
    throw new BadRequestException(INVALID_PUSH_REQUEST);
  }

  const bytes = Buffer.from(value, 'base64url');
  if (
    bytes.length !== CAPABILITY_BYTES ||
    bytes.toString('base64url') !== value
  ) {
    throw new BadRequestException(INVALID_PUSH_REQUEST);
  }

  return bytes;
}

export function compareCapabilityHash(
  candidateHash: string,
  storedHash: string,
): boolean {
  if (
    !SHA256_HEX_PATTERN.test(candidateHash) ||
    !SHA256_HEX_PATTERN.test(storedHash)
  ) {
    return false;
  }

  const candidate = Buffer.from(candidateHash, 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return (
    candidate.length === stored.length && timingSafeEqual(candidate, stored)
  );
}

@Injectable()
export class InstallationCapabilityGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PushGuardRequest>();
    const headers = validatePushDto(
      {
        installationId: request.headers['x-push-installation'],
        capability: request.headers['x-push-capability'],
      },
      PushInstallationHeadersDto,
    );
    const capabilityBytes = decodeCapabilityHeader(headers.capability);
    const candidateHash = createHash('sha256')
      .update(capabilityBytes)
      .digest('hex');

    let installation: { id: string; secretHash: string } | null;
    try {
      installation = await this.prisma.pushInstallation.findUnique({
        where: { id: headers.installationId },
        select: { id: true, secretHash: true },
      });
    } catch {
      throw new InternalServerErrorException(PUSH_OPERATION_FAILED);
    }

    if (
      installation === null ||
      !compareCapabilityHash(candidateHash, installation.secretHash)
    ) {
      throw new ForbiddenException(INVALID_INSTALLATION_PROOF);
    }

    request.pushInstallationId = installation.id;
    return true;
  }
}
