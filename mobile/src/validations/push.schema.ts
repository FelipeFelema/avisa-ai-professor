import { z } from 'zod';

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const capabilityPattern = /^[A-Za-z0-9_-]{43}$/;
const expoTokenPattern = /^(?:ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{8,256}\]$/;
const maxPushInteger = 2147483647;

const uuidV4Schema = z.string().regex(uuidV4Pattern);
const pushIntegerSchema = z.number().int().min(0).max(maxPushInteger);
const positivePushIntegerSchema = z.number().int().min(1).max(maxPushInteger);
const dateTimeSchema = z.string().datetime({ offset: true });

export const pushInstallationHeadersSchema = z
  .object({
    installationId: uuidV4Schema,
    capability: z.string().regex(capabilityPattern),
  })
  .strict();

export const activatePushSchema = z
  .object({
    bindingId: uuidV4Schema,
    lifecycleVersion: positivePushIntegerSchema,
    expectedTokenRevision: pushIntegerSchema,
    platform: z.enum(['ANDROID', 'IOS']),
    expoToken: z.string().min(1).max(512).regex(expoTokenPattern),
    permission: z.literal('GRANTED'),
  })
  .strict();

export const revokePushSchema = z
  .object({
    bindingId: uuidV4Schema,
    lifecycleVersion: positivePushIntegerSchema,
    reason: z.enum(['USER_DISABLED', 'LOGOUT', 'PERMISSION_REVOKED']),
  })
  .strict();

export const emptyPushRequestSchema = z.object({}).strict();

export const pushBindingViewSchema = z
  .object({
    bindingId: uuidV4Schema,
    lifecycleVersion: positivePushIntegerSchema,
    tokenRevision: pushIntegerSchema,
    state: z.enum(['RESERVED', 'ACTIVE']),
  })
  .strict();

export const pushInstallationViewSchema = z
  .object({
    available: z.boolean(),
    state: z.enum(['ABSENT', 'RESERVED', 'ACTIVE', 'INACTIVE']),
    binding: pushBindingViewSchema.nullable(),
    reason: z
      .enum(['CONFIGURATION_UNAVAILABLE', 'REGISTRATION_INACTIVE', 'TOKEN_INVALID'])
      .nullable(),
    testAvailableAt: dateTimeSchema.nullable(),
  })
  .strict();

export const pushTestAcceptedSchema = z
  .object({
    attemptId: uuidV4Schema,
    status: z.literal('ACCEPTED'),
    acceptedAt: dateTimeSchema,
    nextTestAvailableAt: dateTimeSchema,
  })
  .strict();
