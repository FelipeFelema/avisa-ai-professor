import { IsString, IsUUID, Matches, Length } from 'class-validator';

export class PushInstallationHeadersDto {
  @IsUUID('4')
  installationId!: string;

  @IsString()
  @Length(43, 43)
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  capability!: string;
}
