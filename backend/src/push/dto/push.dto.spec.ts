import { BadRequestException } from '@nestjs/common';
import {
  assertNoPushQuery,
  assertStrictEmptyPushBody,
  validatePushDto,
} from './push-request.validation';
import { ActivatePushDto } from './activate-push.dto';
import { EmptyPushDto } from './empty-push.dto';
import { PushInstallationHeadersDto } from './push-installation-headers.dto';

const validHeaders = {
  installationId: '00000000-0000-4000-8000-000000000001',
  capability: 'A'.repeat(43),
};

const validActivation = {
  bindingId: '00000000-0000-4000-8000-000000000002',
  lifecycleVersion: 1,
  expectedTokenRevision: 0,
  platform: 'ANDROID',
  expoToken: `ExpoPushToken[${'A'.repeat(16)}]`,
  permission: 'GRANTED',
};

describe('push DTO validation', () => {
  it('accepts a bounded installation header shape without decoding its capability', () => {
    expect(
      validatePushDto(validHeaders, PushInstallationHeadersDto),
    ).toBeInstanceOf(PushInstallationHeadersDto);
  });

  it.each([0, -1, 2147483648, 1.5, '1'])(
    'rejects an invalid lifecycle version %p',
    (lifecycleVersion) => {
      expect(() =>
        validatePushDto(
          { ...validActivation, lifecycleVersion },
          ActivatePushDto,
        ),
      ).toThrow(BadRequestException);
    },
  );

  it.each([-1, 2147483648, 1.5, '0'])(
    'rejects an invalid expected token revision %p',
    (expectedTokenRevision) => {
      expect(() =>
        validatePushDto(
          { ...validActivation, expectedTokenRevision },
          ActivatePushDto,
        ),
      ).toThrow(BadRequestException);
    },
  );

  it.each([
    'ExpoPushToken[short]',
    `ExpoPushToken[${'A'.repeat(257)}]`,
    `ExpoPushToken[${'A'.repeat(8)} ${'A'.repeat(8)}]`,
    `ExponentPushToken[${'A'.repeat(16)}]\n`,
    `ExpoPushToken[${'é'.repeat(8)}]`,
    `ExponentPushToken[${'A'.repeat(7)}]`,
  ])(
    'rejects malformed Expo token strings without echoing the value',
    (expoToken) => {
      let caught: unknown;
      try {
        validatePushDto({ ...validActivation, expoToken }, ActivatePushDto);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(BadRequestException);
      expect((caught as Error).message).not.toContain(expoToken);
    },
  );

  it('accepts the documented legacy ExponentPushToken format', () => {
    expect(
      validatePushDto(
        {
          ...validActivation,
          expoToken: `ExponentPushToken[${'A'.repeat(8)}]`,
        },
        ActivatePushDto,
      ),
    ).toBeInstanceOf(ActivatePushDto);
  });

  it('rejects an empty body with extra properties and never echoes them', () => {
    const privateMarker = 'private-user-id-sentinel';

    try {
      assertStrictEmptyPushBody({ userId: privateMarker }, EmptyPushDto);
      throw new Error('expected body validation to reject the input');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).not.toContain(privateMarker);
    }
  });

  it('accepts the strictly empty reserve/test body', () => {
    expect(assertStrictEmptyPushBody({}, EmptyPushDto)).toBeInstanceOf(
      EmptyPushDto,
    );
  });

  it('rejects arrays, null and non-object bodies', () => {
    for (const body of [[], null, 'body', 3]) {
      expect(() => assertStrictEmptyPushBody(body, EmptyPushDto)).toThrow(
        BadRequestException,
      );
    }
  });

  it('rejects every query parameter, including destination selectors', () => {
    for (const query of [
      { userId: 'private-user-id-sentinel' },
      { installationId: 'private-installation-sentinel' },
      { token: 'private-token-sentinel' },
    ]) {
      expect(() => assertNoPushQuery(query)).toThrow(BadRequestException);
    }
  });
});
