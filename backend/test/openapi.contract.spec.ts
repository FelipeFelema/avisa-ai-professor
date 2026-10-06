import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './helpers/test-app.helper';
import { isOpenApiEnabled } from '../src/openapi/configure-openapi';

type OpenApiSchema = {
  $ref?: string;
  type?: string;
  format?: string;
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  [key: string]: unknown;
};

type OpenApiOperation = {
  operationId: string;
  tags: string[];
  summary: string;
  description?: string;
  parameters?: Array<Record<string, any>>;
  security?: Array<Record<string, string[]>>;
  requestBody?: {
    required?: boolean;
    content?: {
      'application/json'?: {
        schema?: OpenApiSchema;
      };
    };
  };
  responses: Record<
    string,
    {
      headers?: Record<
        string,
        { description?: string; schema?: OpenApiSchema }
      >;
      content?: {
        'application/json'?: {
          schema?: OpenApiSchema;
        };
      };
      description?: string;
    }
  >;
  [key: string]: unknown;
};

type OpenApiDocument = {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    securitySchemes: Record<string, Record<string, string>>;
    schemas: Record<string, OpenApiSchema>;
    parameters?: Record<string, OpenApiSchema>;
  };
};

const designContract = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      '../../specs/001-app-quality-readiness/contracts/openapi.json',
    ),
    'utf8',
  ),
) as OpenApiDocument;

const httpMethods = new Set([
  'get',
  'post',
  'patch',
  'put',
  'delete',
  'options',
  'head',
  'trace',
]);

function operationEntries(
  document: OpenApiDocument,
): Array<[string, string, OpenApiOperation]> {
  return Object.entries(document.paths).flatMap(([path, methods]) =>
    Object.entries(methods)
      .filter(([method]) => httpMethods.has(method))
      .map(
        ([method, operation]) =>
          [path, method, operation] as [string, string, OpenApiOperation],
      ),
  );
}

function sortParameters(
  parameters: Array<Record<string, any>>,
): Array<Record<string, any>> {
  return parameters
    .slice()
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

function resolveRef(
  value: OpenApiSchema,
  document: OpenApiDocument,
): OpenApiSchema {
  const ref = value.$ref;
  if (!ref?.startsWith('#/components/parameters/')) {
    return value;
  }

  const name = ref.replace('#/components/parameters/', '');
  return document.components.parameters?.[name] ?? value;
}

function expectSchemaMatch(
  actual: OpenApiSchema | undefined,
  expected: OpenApiSchema,
): void {
  expect(actual).toBeDefined();

  if (expected.$ref) {
    expect(actual?.$ref ?? actual?.allOf?.[0]?.$ref).toBe(expected.$ref);
    return;
  }

  for (const key of Object.keys(expected)) {
    if (['properties', 'required', 'oneOf', 'allOf'].includes(key)) continue;
    expect(actual?.[key]).toEqual(expected[key]);
  }

  if (expected.required) {
    expect(actual?.required?.slice().sort()).toEqual(
      expected.required.slice().sort(),
    );
  }
  if (expected.properties) {
    expect(Object.keys(actual?.properties ?? {}).sort()).toEqual(
      Object.keys(expected.properties).sort(),
    );
    for (const [property, schema] of Object.entries(expected.properties)) {
      expectSchemaMatch(actual?.properties?.[property], schema);
    }
  }
  if (expected.oneOf) {
    expect(actual?.oneOf).toHaveLength(expected.oneOf.length);
    expected.oneOf.forEach((schema: OpenApiSchema, index: number) =>
      expectSchemaMatch(actual?.oneOf?.[index], schema),
    );
  }
  if (expected.allOf) {
    expect(actual?.allOf).toHaveLength(expected.allOf.length);
    expected.allOf.forEach((schema: OpenApiSchema, index: number) =>
      expectSchemaMatch(actual?.allOf?.[index], schema),
    );
  }
}

describe('OpenAPI runtime contract', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents read-only impact and the closed authenticated own-account DELETE', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/docs/openapi.json')
      .expect(200);
    const runtime = response.body as OpenApiDocument;
    for (const document of [runtime, designContract]) {
      const operation = document.paths['/api/v1/users/account-deletion']?.get;
      expect(operation?.operationId).toBe('users.getAccountDeletionImpact');
      expect(operation?.security).toEqual([{ bearerAuth: [] }]);
      expect(operation?.parameters ?? []).toEqual([]);
      expect(operation?.requestBody).toBeUndefined();
      const deletion = document.paths['/api/v1/users/account']?.delete;
      expect(deletion?.operationId).toBe('users.deleteOwnAccount');
      expect(deletion?.security).toEqual([{ bearerAuth: [] }]);
      expect(deletion?.parameters ?? []).toEqual([]);
      expect(Object.keys(deletion?.responses ?? {}).sort()).toEqual([
        '204',
        '400',
        '401',
        '409',
        '429',
        '500',
      ]);
      expect(deletion?.responses['204'].content).toBeUndefined();
      const requestBody = deletion?.requestBody as {
        required?: boolean;
        content?: { 'application/json'?: { schema?: { $ref?: string } } };
      };
      expect(requestBody.required).toBe(true);
      expect(requestBody.content?.['application/json']?.schema?.$ref).toBe(
        '#/components/schemas/DeleteAccountRequest',
      );
      const deleteSchema = document.components.schemas.DeleteAccountRequest;
      expect(deleteSchema?.additionalProperties).toBe(false);
      expect(deleteSchema?.required?.slice().sort()).toEqual(
        ['currentPassword', 'confirmationPhrase'].sort(),
      );
      for (const field of ['currentPassword', 'confirmationPhrase'])
        expect(deleteSchema?.properties?.[field]).toMatchObject({
          type: 'string',
          writeOnly: true,
        });
      expect(deleteSchema?.properties?.confirmationPhrase?.enum).toEqual([
        'EXCLUIR MINHA CONTA',
      ]);
      expect(deletion?.responses['400'].description).toContain(
        'CURRENT_PASSWORD_INVALID',
      );
      expect(deletion?.responses['409'].description).toContain(
        'LAST_ADMIN_REQUIRED',
      );
      const schema = document.components.schemas.AccountDeletionImpact;
      expect(schema?.additionalProperties).toBe(false);
      expect(schema?.required?.slice().sort()).toEqual(
        [
          'role',
          'canDelete',
          'blockReason',
          'ownedClassroomsCount',
          'announcementsInOwnedClassroomsCount',
          'externalMembershipsCount',
          'authoredAnnouncementsInOtherClassroomsCount',
        ].sort(),
      );
      expect(schema?.properties?.role?.enum).toEqual([
        'PARENT',
        'PROFESSOR',
        'ADMIN',
      ]);
      expect(schema?.properties?.blockReason).toMatchObject({
        nullable: true,
        enum: ['LAST_ADMIN_REQUIRED'],
      });
      for (const name of [
        'ownedClassroomsCount',
        'announcementsInOwnedClassroomsCount',
        'externalMembershipsCount',
        'authoredAnnouncementsInOtherClassroomsCount',
      ])
        expect(schema?.properties?.[name]).toMatchObject({
          type: 'integer',
          minimum: 0,
        });
    }
  });

  it('documents the closed write-only password request, protected operation and empty success', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/docs/openapi.json')
      .expect(200);
    const runtime = response.body as OpenApiDocument;
    const operation = runtime.paths['/api/v1/auth/change-password']?.post;
    expect(operation?.operationId).toBe('auth.changePassword');
    expect(operation?.security).toEqual([{ bearerAuth: [] }]);
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual([
      '204',
      '400',
      '401',
      '409',
      '429',
      '500',
    ]);
    expect(operation?.responses['204'].content).toBeUndefined();
    const schema = runtime.components.schemas.ChangePasswordRequest;
    expect(schema?.additionalProperties).toBe(false);
    expect(schema?.required?.slice().sort()).toEqual([
      'confirmNewPassword',
      'currentPassword',
      'newPassword',
    ]);
    for (const property of Object.values(schema?.properties ?? {}))
      expect(property).toMatchObject({ type: 'string', writeOnly: true });
    expect(schema?.properties?.newPassword).toMatchObject({
      minLength: 6,
      maxLength: 72,
    });
    expect(schema?.properties?.currentPassword?.maxLength).toBeUndefined();
    for (const name of [
      'UserProfile',
      'RegisterResponse',
      'AuthTokensResponse',
    ]) {
      const properties = Object.keys(
        runtime.components.schemas[name]?.properties ?? {},
      );
      expect(properties.some((key) => /password/i.test(key))).toBe(false);
    }
  });

  it('publishes the exact operation inventory and required metadata', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/docs/openapi.json')
      .expect(200);
    const runtime = response.body as OpenApiDocument;
    const expectedOperations = operationEntries(designContract);
    const actualOperations = operationEntries(runtime);

    expect(runtime.openapi).toBe(designContract.openapi);
    expect(runtime.info.title).toBe(designContract.info.title);
    expect(runtime.info.version).toBe(designContract.info.version);
    expect(actualOperations).toHaveLength(expectedOperations.length);

    for (const [path, method, expected] of expectedOperations) {
      const actual = runtime.paths[path]?.[method];

      expect(actual).toBeDefined();
      expect(actual.operationId).toBe(expected.operationId);
      expect(actual.tags).toEqual(expected.tags);
      expect(actual.summary).toBe(expected.summary);
      expect(actual.description).toBe(expected.description);
      expect(actual.security).toEqual(expected.security);
      expect(Object.keys(actual.responses).sort()).toEqual(
        Object.keys(expected.responses).sort(),
      );

      const expectedParameters = (expected.parameters ?? []).map((parameter) =>
        resolveRef(parameter, designContract),
      );
      const actualParameters = actual.parameters ?? [];
      expect(actualParameters).toHaveLength(expectedParameters.length);
      expect(sortParameters(actualParameters)).toEqual(
        sortParameters(expectedParameters),
      );

      const expectedRequestSchema =
        expected.requestBody?.content?.['application/json']?.schema?.$ref;
      if (expectedRequestSchema) {
        expect(actual.requestBody?.required).toBe(
          expected.requestBody?.required,
        );
        expect(
          actual.requestBody?.content?.['application/json']?.schema?.$ref,
        ).toBe(expectedRequestSchema);
      }

      for (const [status, expectedResponse] of Object.entries(
        expected.responses,
      )) {
        if (expectedResponse.description !== undefined) {
          expect(actual.responses[status]?.description).toBe(
            expectedResponse.description,
          );
        }
        const expectedResponseSchema =
          expectedResponse.content?.['application/json']?.schema?.$ref;
        if (expectedResponseSchema) {
          expect(
            actual.responses[status]?.content?.['application/json']?.schema
              ?.$ref,
          ).toBe(expectedResponseSchema);
        }
        for (const [header, expectedHeader] of Object.entries(
          expectedResponse.headers ?? {},
        )) {
          expect(actual.responses[status]?.headers?.[header]).toEqual(
            expectedHeader,
          );
        }
      }
    }

    for (const document of [runtime, designContract]) {
      const pushOperations = operationEntries(document).filter(([path]) =>
        path.startsWith('/api/v1/push/'),
      );
      expect(
        pushOperations.map(([path, method]) => `${method} ${path}`).sort(),
      ).toEqual(
        [
          'delete /api/v1/push/installation',
          'get /api/v1/push/installation',
          'post /api/v1/push/installation/reserve',
          'post /api/v1/push/installation/test',
          'put /api/v1/push/installation',
        ].sort(),
      );

      for (const [path, method, operation] of pushOperations) {
        expect(operation['x-max-request-bytes']).toBe(2048);
        expect(sortParameters(operation.parameters ?? [])).toEqual(
          sortParameters([
            {
              name: 'X-Push-Installation',
              in: 'header',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'X-Push-Capability',
              in: 'header',
              description: 'Capability privada base64url de 32 bytes.',
              required: true,
              schema: { type: 'string' },
            },
          ]),
        );
        if (method === 'delete') {
          expect(operation.security).toBeUndefined();
          expect(operation.responses).not.toHaveProperty('401');
        } else {
          expect(operation.security).toEqual([{ bearerAuth: [] }]);
        }
        for (const response of Object.values(operation.responses)) {
          expect(response.headers?.['Cache-Control']).toEqual({
            description: 'no-store',
            schema: { type: 'string' },
          });
        }
        if (method === 'get') {
          expect(operation.requestBody).toBeUndefined();
          expect(
            operation.responses['200'].content?.['application/json']?.schema
              ?.$ref,
          ).toBe('#/components/schemas/PushInstallationView');
        }
        if (method === 'delete') {
          expect(
            operation.requestBody?.content?.['application/json']?.schema?.$ref,
          ).toBe('#/components/schemas/RevokePushRequest');
          expect(Object.keys(operation.responses).sort()).toEqual([
            '204',
            '400',
            '403',
            '429',
          ]);
        }
        if (method === 'post') {
          expect(
            operation.requestBody?.content?.['application/json']?.schema?.$ref,
          ).toBe('#/components/schemas/EmptyPushRequest');
          if (path.endsWith('/reserve')) {
            expect(
              operation.responses['200'].content?.['application/json']?.schema
                ?.$ref,
            ).toBe('#/components/schemas/PushBindingView');
          } else {
            expect(path).toBe('/api/v1/push/installation/test');
            expect(operation.operationId).toBe('push.testInstallation');
            expect(operation.description).toMatch(
              /aceite do ticket.*n[aã]o a exibi[cç][aã]o/i,
            );
            expect(
              operation.responses['202'].content?.['application/json']?.schema
                ?.$ref,
            ).toBe('#/components/schemas/PushTestAccepted');
            expect(operation.responses['429'].headers?.['Retry-After']).toEqual(
              {
                description: 'Segundos até uma nova intenção ser permitida.',
                schema: { type: 'integer', minimum: 1 },
              },
            );
            expect(Object.keys(operation.responses).sort()).toEqual([
              '202',
              '400',
              '401',
              '403',
              '409',
              '429',
              '503',
            ]);
          }
        }
        if (method === 'put') {
          expect(operation.description).toMatch(
            /expectedTokenRevision.*compare-and-swap/i,
          );
          expect(operation.description).toMatch(
            /REVOKED\/INVALID.*nova reserva/i,
          );
          expect(
            operation.requestBody?.content?.['application/json']?.schema?.$ref,
          ).toBe('#/components/schemas/ActivatePushRequest');
          expect(
            operation.responses['200'].content?.['application/json']?.schema
              ?.$ref,
          ).toBe('#/components/schemas/PushBindingView');
        }
      }

      const emptyRequest = document.components.schemas.EmptyPushRequest;
      expect(emptyRequest).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
      expect(emptyRequest.properties ?? {}).toEqual({});

      const activation = document.components.schemas.ActivatePushRequest;
      expect(activation).toMatchObject({
        type: 'object',
        additionalProperties: false,
        required: [
          'bindingId',
          'lifecycleVersion',
          'expectedTokenRevision',
          'platform',
          'expoToken',
          'permission',
        ],
      });
      expect(activation.properties?.expoToken).toMatchObject({
        type: 'string',
        minLength: 1,
        maxLength: 512,
      });
      expect(activation.properties?.lifecycleVersion).toMatchObject({
        type: 'integer',
        minimum: 1,
        maximum: 2147483647,
      });
      expect(activation.properties?.expectedTokenRevision).toMatchObject({
        type: 'integer',
        minimum: 0,
        maximum: 2147483647,
      });
      expect(document.components.schemas.RevokePushRequest).toMatchObject({
        type: 'object',
        additionalProperties: false,
        properties: {
          reason: {
            type: 'string',
            enum: ['USER_DISABLED', 'LOGOUT', 'PERMISSION_REVOKED'],
          },
        },
      });
      const view = document.components.schemas.PushInstallationView;
      expect(
        view.properties?.binding?.oneOf?.map((part) => part.type ?? part.$ref),
      ).toEqual(['#/components/schemas/PushBindingView', 'null']);
      expect(view.properties?.reason?.oneOf?.map((part) => part.type)).toEqual([
        'string',
        'null',
      ]);
      for (const schemaName of ['PushBindingView', 'PushInstallationView']) {
        const schema = document.components.schemas[schemaName];
        expect(schema?.additionalProperties).toBe(false);
        const properties = Object.keys(schema?.properties ?? {});
        expect(
          properties.some((name) =>
            [
              'expoToken',
              'userId',
              'sessionId',
              'capability',
              'secretHash',
              'providerTicketId',
            ].includes(name),
          ),
        ).toBe(false);
      }
      expect(document.components.schemas.PushTestAccepted).toMatchObject({
        type: 'object',
        additionalProperties: false,
        required: ['attemptId', 'status', 'acceptedAt', 'nextTestAvailableAt'],
        properties: {
          status: { type: 'string', enum: ['ACCEPTED'] },
          acceptedAt: { type: 'string', format: 'date-time' },
          nextTestAvailableAt: { type: 'string', format: 'date-time' },
        },
      });
    }

    const inviteRequest =
      designContract.components.schemas.CreateInviteCodeRequest;
    expect(inviteRequest).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['role'],
      properties: { role: { type: 'string', enum: ['PROFESSOR'] } },
    });
    expect(inviteRequest.properties).not.toHaveProperty('expiresInDays');
    expect(
      designContract.components.schemas.InviteCodeResponse.properties?.role,
    ).toEqual({
      type: 'string',
      enum: ['PROFESSOR'],
    });
    expect(
      designContract.components.schemas.InviteCodeResponse.properties?.isActive,
    ).toEqual({
      type: 'boolean',
    });
    expect(
      designContract.paths['/api/v1/invite-codes']?.post?.operationId,
    ).toBe('inviteCodes.create');
    expect(
      designContract.paths['/api/v1/invite-codes']?.post?.responses['201']
        ?.headers?.['Cache-Control'],
    ).toEqual({
      description: 'no-store',
      schema: { type: 'string' },
    });
    expect(
      designContract.paths['/api/v1/auth/register']?.post?.description,
    ).toContain('ADMIN não pode ser provisionado pelo cadastro público');

    const canonicalSearchParameter = designContract.paths[
      '/api/v1/classrooms'
    ]?.get?.parameters?.find((parameter) => parameter['name'] === 'search');
    const runtimeSearchParameter = runtime.paths[
      '/api/v1/classrooms'
    ]?.get?.parameters?.find((parameter) => parameter['name'] === 'search');

    expect(canonicalSearchParameter).toMatchObject({
      name: 'search',
      in: 'query',
      required: false,
      style: 'form',
      explode: true,
      schema: { type: 'string', maxLength: 80 },
    });
    expect(runtimeSearchParameter).toEqual(canonicalSearchParameter);
    expect(canonicalSearchParameter?.['schema']).not.toHaveProperty(
      'minLength',
    );
    expect(canonicalSearchParameter?.['description']).toContain(
      'é aplicado após remover espaços externos',
    );
    expect(canonicalSearchParameter?.['description']).toContain(
      'valores repetidos são rejeitados',
    );

    expect(runtime.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(runtime.components.schemas.ErrorResponse).toMatchObject({
      type: 'object',
      required: ['statusCode', 'message'],
    });
    expect(Object.keys(runtime.components.schemas).sort()).toEqual(
      Object.keys(designContract.components.schemas).sort(),
    );
    for (const [schemaName, expectedSchema] of Object.entries(
      designContract.components.schemas,
    )) {
      expectSchemaMatch(runtime.components.schemas[schemaName], expectedSchema);
    }

    expect(runtime.components.schemas.LastAnnouncementSummary.required).toEqual(
      expect.arrayContaining(['expiresAt']),
    );
    expect(
      runtime.components.schemas.LastAnnouncementSummary.properties?.expiresAt,
    ).toEqual({ type: 'string', format: 'date-time' });

    expect(runtime.components.schemas.AuthTokensResponse.description).toMatch(
      /\bsid\b/i,
    );
  });
});

describe('OpenAPI environment gate', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDocsFlag = process.env.API_DOCS_ENABLED;

  afterEach(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousDocsFlag === undefined) delete process.env.API_DOCS_ENABLED;
    else process.env.API_DOCS_ENABLED = previousDocsFlag;
  });

  it.each([
    ['missing', undefined],
    ['unknown', 'staging'],
    ['production', 'production'],
  ])('denies docs for %s NODE_ENV', (_label, nodeEnv) => {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    process.env.API_DOCS_ENABLED = 'true';

    expect(isOpenApiEnabled()).toBe(false);
  });

  it.each(['development', 'test'])('allows docs in %s NODE_ENV', (nodeEnv) => {
    process.env.NODE_ENV = nodeEnv;
    delete process.env.API_DOCS_ENABLED;

    expect(isOpenApiEnabled()).toBe(true);
  });

  it('preserves the kill switch in allowed environments', () => {
    process.env.NODE_ENV = 'development';
    process.env.API_DOCS_ENABLED = 'false';

    expect(isOpenApiEnabled()).toBe(false);
  });
});
