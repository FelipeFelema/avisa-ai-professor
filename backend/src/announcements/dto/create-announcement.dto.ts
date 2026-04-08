import { IsNotEmpty, IsString, IsInt, Min, IsUUID } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsInt()
  @Min(1)
  durationInDays!: number;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  classroomId!: string;
}
