import { Transform } from 'class-transformer';
import { ApiProperty, ApiSchema, ApiSchemaOptions } from '@nestjs/swagger';
import { Equals, IsNotEmpty, IsString } from 'class-validator';

const closedOptions: ApiSchemaOptions & { additionalProperties: false } = {
  name: 'DeleteAccountRequest',
  additionalProperties: false,
};
const rawValue = () =>
  Transform(
    ({ obj, key }: { obj: Record<string, unknown>; key: string }) => obj[key],
  );

@ApiSchema(closedOptions)
export class DeleteAccountDto {
  @ApiProperty({
    type: 'string',
    minLength: 1,
    writeOnly: true,
    description:
      'String não vazia, preservada integralmente, sem novo limite de senha sobre credenciais existentes. Sem trim, normalização ou coerção.',
  })
  @rawValue()
  @IsString({ message: 'A senha atual deve ser uma string.' })
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  currentPassword: string;

  @ApiProperty({
    type: 'string',
    enum: ['EXCLUIR MINHA CONTA'],
    writeOnly: true,
    description:
      'String exatamente EXCLUIR MINHA CONTA. Sem trim, normalização ou coerção.',
  })
  @rawValue()
  @IsString({ message: 'A confirmação deve ser uma string.' })
  @Equals('EXCLUIR MINHA CONTA', {
    message: 'ACCOUNT_DELETION_CONFIRMATION_MISMATCH',
  })
  confirmationPhrase: string;
}
