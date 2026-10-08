import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import express from 'express';
import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from 'express';
import { SanitizedExceptionFilter } from './common/filters/sanitized-exception.filter';
import { createSec013ProxyDiagnostics } from './common/middleware/proxy-diagnostics.middleware';
import { trustedProxyCidrs } from './config/trusted-proxy.config';
import {
  productionCorsOrigins,
  validateProductionConfig,
} from './config/production.config';

function parserErrorStatus(error: unknown): number | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status;
  }
  return undefined;
}

export function configureApp(app: INestApplication): INestApplication {
  validateProductionConfig(process.env);
  const server = app.getHttpAdapter().getInstance() as {
    set(key: string, value: false | string[]): void;
  };
  server.set('trust proxy', trustedProxyCidrs());
  const diagnostics = createSec013ProxyDiagnostics();
  if (diagnostics) app.use(diagnostics);
  const corsOrigins =
    process.env.NODE_ENV === 'production'
      ? productionCorsOrigins(process.env)
      : (process.env.CORS_ORIGIN?.split(',')
          .map((value) => value.trim())
          .filter(Boolean) ?? ['http://localhost:3000']);
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.use(
    '/api/v1/push',
    (request: Request, response: Response, next: NextFunction) => {
      response.setHeader('Cache-Control', 'no-store');

      const requestedMethod = request.header('access-control-request-method');
      if (
        request.method === 'OPTIONS' &&
        requestedMethod?.toUpperCase() === 'PUT'
      ) {
        const origin = request.header('origin');
        if (origin && corsOrigins.includes(origin)) {
          response.setHeader('Access-Control-Allow-Origin', origin);
          response.setHeader('Access-Control-Allow-Credentials', 'true');
          response.setHeader('Vary', 'Origin');
        }
        response.setHeader(
          'Access-Control-Allow-Methods',
          'GET,POST,PUT,DELETE,OPTIONS',
        );
        response.setHeader(
          'Access-Control-Allow-Headers',
          'Authorization,Content-Type,X-Push-Installation,X-Push-Capability',
        );
        response.status(204).end();
        return;
      }
      next();
    },
  );
  app.use('/api/v1/push', express.json({ limit: '2kb', strict: true }));
  app.use(express.json({ limit: '100kb', strict: true }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  const pushParserErrorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    next,
  ) => {
    const status = parserErrorStatus(error);
    if (status === 400 || status === 413) {
      response.status(status).json({
        statusCode: status,
        message: 'PUSH_INVALID_REQUEST',
        error: status === 413 ? 'Payload Too Large' : 'Bad Request',
      });
      return;
    }
    next(error);
  };
  app.use('/api/v1/push', pushParserErrorHandler);
  const parserErrorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    next,
  ) => {
    const status = parserErrorStatus(error);
    if (status === 400 || status === 413) {
      response.status(status).json({
        statusCode: status,
        message: 'INVALID_REQUEST',
        error: status === 413 ? 'Payload Too Large' : 'Bad Request',
      });
      return;
    }
    next(error);
  };
  app.use(parserErrorHandler);
  app.useGlobalFilters(new SanitizedExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  return app;
}
