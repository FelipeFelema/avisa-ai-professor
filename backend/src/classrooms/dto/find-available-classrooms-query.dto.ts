import { Transform } from 'class-transformer';
import {
  IsString,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const INVALID_SEARCH_MESSAGE =
  'Valores não textuais ou múltiplos são inválidos na fronteira HTTP.';
const SEARCH_LENGTH_MESSAGE =
  'A pesquisa deve ter no máximo 80 pontos de código Unicode após o trim.';

@ValidatorConstraint({ name: 'classroomSearchMaxCodePoints', async: false })
class ClassroomSearchMaxCodePointsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value !== 'string' || Array.from(value).length <= 80;
  }
}

export class FindAvailableClassroomsQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString({ message: INVALID_SEARCH_MESSAGE })
  @Validate(ClassroomSearchMaxCodePointsConstraint, {
    message: SEARCH_LENGTH_MESSAGE,
  })
  search?: unknown;
}
