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
      content?: {
        'application/json'?: {
          schema?: OpenApiSchema;
        };
      };
      description?: string;
    }
  >;
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
      expect(actualParameters).toEqual(expectedParameters);

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
      }
    }

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
