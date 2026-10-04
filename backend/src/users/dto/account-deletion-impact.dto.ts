import { Role } from '@prisma/client';
import { ApiProperty, ApiSchema, ApiSchemaOptions } from '@nestjs/swagger';

const closedOptions: ApiSchemaOptions & { additionalProperties: false } = {
  name: 'AccountDeletionImpact',
  additionalProperties: false,
};

@ApiSchema(closedOptions)
export class AccountDeletionImpactDto {
  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ type: Boolean })
  canDelete: boolean;

  @ApiProperty({ type: String, enum: ['LAST_ADMIN_REQUIRED'], nullable: true })
  blockReason: 'LAST_ADMIN_REQUIRED' | null;

  @ApiProperty({ type: 'integer', minimum: 0 })
  ownedClassroomsCount: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  announcementsInOwnedClassroomsCount: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  externalMembershipsCount: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  authoredAnnouncementsInOtherClassroomsCount: number;
}
