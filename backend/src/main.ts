import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { configureOpenApi } from './openapi/configure-openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);
  configureOpenApi(app);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((err) => {
  console.error('Erro ao iniciar a aplicação:', err);
});
