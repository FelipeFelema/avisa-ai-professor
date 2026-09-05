import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './helpers/test-app.helper';

type OpenApiOperation = {
  operationId: string;
  tags: string[];
  summary: string;
  security?: Array<Record<string, string[]>>;
  requestBody?: {
    content?: {
      'application/json'?: {
        schema?: { $ref?: string };
      };
    };
  };
  responses: Record<
    string,
    {
      content?: {
        'application/json'?: {
          schema?: { $ref?: string };
        };
      };
    }
  >;
};

type OpenApiDocument = {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    securitySchemes: Record<string, Record<string, string>>;
    schemas: Record<string, unknown>;
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
      expect(actual.security).toEqual(expected.security);
      expect(Object.keys(actual.responses).sort()).toEqual(
        Object.keys(expected.responses).sort(),
      );

      const expectedRequestSchema =
        expected.requestBody?.content?.['application/json']?.schema?.$ref;
      if (expectedRequestSchema) {
        expect(
          actual.requestBody?.content?.['application/json']?.schema?.$ref,
        ).toBe(expectedRequestSchema);
      }

      for (const [status, expectedResponse] of Object.entries(
        expected.responses,
      )) {
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
    const registerResponse = runtime.components.schemas.RegisterResponse as {
      allOf?: unknown;
    };
    expect(Array.isArray(registerResponse.allOf)).toBe(true);
    for (const schemaName of Object.keys(designContract.components.schemas)) {
      expect(runtime.components.schemas[schemaName]).toBeDefined();
    }
  });
});
