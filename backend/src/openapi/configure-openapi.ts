import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureOpenApi(app: INestApplication): void {
  if (!isOpenApiEnabled()) {
    return;
  }

  const documentConfig = new DocumentBuilder()
    .setOpenAPIVersion('3.0.3')
    .setTitle('Avisa Aí Professor API')
    .setVersion('1.0.0')
    .setDescription(
      'Contrato de design da API REST v1. A referência executável será gerada pelos DTOs e decorators NestJS e ficará disponível somente fora de produção.',
    )
    .addServer('http://localhost:3000', 'Desenvolvimento local')
    .addTag('health', 'Saúde da API')
    .addTag('auth', 'Cadastro e sessão JWT')
    .addTag('users', 'Perfil do usuário autenticado')
    .addTag('classrooms', 'Turmas, ownership e memberships')
    .addTag('announcements', 'Comunicados de turma')
    .addTag('invite-codes', 'Convites administrativos')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token de desenvolvimento. A referência não persiste nem fornece credenciais.',
      },
      'bearerAuth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);

  SwaggerModule.setup('v1/docs', app, document, {
    useGlobalPrefix: true,
    raw: ['json'],
    jsonDocumentUrl: 'v1/docs/openapi.json',
  });
}

export function isOpenApiEnabled(): boolean {
  const configured = process.env.API_DOCS_ENABLED?.toLowerCase();
  const environment = process.env.NODE_ENV?.toLowerCase();

  return (
    (environment === 'development' || environment === 'test') &&
    configured !== 'false'
  );
}
