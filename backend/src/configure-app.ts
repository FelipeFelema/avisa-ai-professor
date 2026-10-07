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
        const origins = process.env.CORS_ORIGIN?.split(',')
          .map((value) => value.trim())
          .filter(Boolean) ?? ['http://localhost:3000'];
        const origin = request.header('origin');
        if (origin && origins.includes(origin)) {
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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  return app;
}
