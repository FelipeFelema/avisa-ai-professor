import {
  activatePushSchema,
  emptyPushRequestSchema,
  pushInstallationViewSchema,
  pushTestAcceptedSchema,
  revokePushSchema,
} from '../../src/validations/push.schema';

const validActivation = {
  bindingId: '00000000-0000-4000-8000-000000000002',
  lifecycleVersion: 1,
  expectedTokenRevision: 0,
  platform: 'ANDROID',
  expoToken: `ExpoPushToken[${'A'.repeat(16)}]`,
  permission: 'GRANTED',
};

describe('push API schemas', () => {
  it('accepts the activation contract and both documented Expo token prefixes', () => {
    expect(activatePushSchema.parse(validActivation)).toEqual(validActivation);
    expect(
      activatePushSchema.safeParse({
        ...validActivation,
        expoToken: `ExponentPushToken[${'Z'.repeat(256)}]`,
      }).success,
    ).toBe(true);
  });

  it('rejects non-v4 IDs, out-of-range integers, non-granted permission and extra fields', () => {
    expect(
      activatePushSchema.safeParse({
        ...validActivation,
        bindingId: '00000000-0000-1000-8000-000000000002',
      }).success,
    ).toBe(false);
    expect(
      activatePushSchema.safeParse({
        ...validActivation,
        lifecycleVersion: 2147483648,
      }).success,
    ).toBe(false);
    expect(
      activatePushSchema.safeParse({
        ...validActivation,
        permission: 'DENIED',
      }).success,
    ).toBe(false);
    expect(
      activatePushSchema.safeParse({
        ...validActivation,
        userId: 'private-user-id-sentinel',
      }).success,
    ).toBe(false);
  });

  it('accepts only empty object requests and the bounded revocation reasons', () => {
    expect(emptyPushRequestSchema.safeParse({}).success).toBe(true);
    expect(emptyPushRequestSchema.safeParse([]).success).toBe(false);
    expect(emptyPushRequestSchema.safeParse({ installationId: 'private' }).success).toBe(false);
    expect(
      revokePushSchema.safeParse({
        bindingId: '00000000-0000-4000-8000-000000000002',
        lifecycleVersion: 1,
        reason: 'LOGOUT',
      }).success,
    ).toBe(true);
    expect(
      revokePushSchema.safeParse({
        bindingId: '00000000-0000-4000-8000-000000000002',
        lifecycleVersion: 1,
        reason: 'SESSION_INACTIVE',
      }).success,
    ).toBe(false);
  });

  it('validates nullable response fields and rejects private response properties', () => {
    const emptyState = {
      available: false,
      state: 'ABSENT',
      binding: null,
      reason: 'CONFIGURATION_UNAVAILABLE',
      testAvailableAt: null,
    };
    expect(pushInstallationViewSchema.safeParse(emptyState).success).toBe(true);
    expect(
      pushInstallationViewSchema.safeParse({
        ...emptyState,
        expoToken: 'private-token-sentinel',
      }).success,
    ).toBe(false);
    expect(
      pushTestAcceptedSchema.safeParse({
        attemptId: '00000000-0000-4000-8000-000000000003',
        status: 'ACCEPTED',
        acceptedAt: '2026-10-05T12:00:00.000Z',
        nextTestAvailableAt: '2026-10-05T12:00:30.000Z',
      }).success,
    ).toBe(true);
  });
});
