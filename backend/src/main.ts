import { NestFactory } from '@nestjs/core';
import { configureApp } from './configure-app';
import { configureOpenApi } from './openapi/configure-openapi';

async function bootstrap() {
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    abortOnError: false,
    logger: false,
  });

  configureApp(app);
  configureOpenApi(app);
  app.useLogger(['error', 'warn', 'log']);
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch(() => {
  console.error('APPLICATION_STARTUP_FAILED');
  process.exit(1);
});
