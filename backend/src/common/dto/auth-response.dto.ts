import {
  ApiExtraModels,
  ApiProperty,
  ApiSchema,
  ApiSchemaOptions,
  getSchemaPath,
} from '@nestjs/swagger';

type ClosedSchemaOptions = ApiSchemaOptions & {
  additionalProperties: false;
};

type ComposedSchemaOptions = ApiSchemaOptions & {
  allOf: Array<{ $ref: string }>;
};

function closedSchema(options: ClosedSchemaOptions): ClassDecorator {
  return ApiSchema(options);
}

function composedSchema(options: ComposedSchemaOptions): ClassDecorator {
  return ApiSchema(options);
}

export enum UserRole {
  PARENT = 'PARENT',
  PROFESSOR = 'PROFESSOR',
  ADMIN = 'ADMIN',
}

@closedSchema({
  name: 'AuthTokensResponse',
  additionalProperties: false,
  description:
    'O sid identifica a sessão JWT e é carregado como claim nos tokens para permitir revogação seletiva.',
})
export class AuthTokensResponseDto {
  @ApiProperty({ type: 'string' })
  access_token!: string;

  @ApiProperty({ type: 'string' })
  refresh_token!: string;
}

@closedSchema({
  name: 'UserProfile',
  additionalProperties: false,
})
export class UserProfileDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: 'string',
    minLength: 3,
    maxLength: 100,
  })
  name!: string;

  @ApiProperty({
    type: 'string',
    format: 'email',
    maxLength: 255,
  })
  email!: string;

  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
  })
  role!: UserRole;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}

@ApiExtraModels(UserProfileDto, AuthTokensResponseDto)
@composedSchema({
  name: 'RegisterResponse',
  allOf: [
    { $ref: getSchemaPath(UserProfileDto) },
    { $ref: getSchemaPath(AuthTokensResponseDto) },
  ],
})
export class RegisterResponseDto {}

export type RegisterResponse = UserProfileDto & AuthTokensResponseDto;
