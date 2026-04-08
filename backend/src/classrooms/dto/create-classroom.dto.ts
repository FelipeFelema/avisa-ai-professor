import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateClassroomDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name!: string;
}
