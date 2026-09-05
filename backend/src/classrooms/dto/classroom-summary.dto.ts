import { ApiProperty, ApiSchema, ApiSchemaOptions } from '@nestjs/swagger';

type ClosedSchemaOptions = ApiSchemaOptions & {
  additionalProperties: false;
};

function closedSchema(options: ClosedSchemaOptions): ClassDecorator {
  return ApiSchema(options);
}

@closedSchema({
  name: 'TeacherSummary',
  additionalProperties: false,
})
export class TeacherSummaryDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;
}

@closedSchema({
  name: 'LastAnnouncementSummary',
  additionalProperties: false,
})
export class LastAnnouncementSummaryDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;
}

@closedSchema({
  name: 'ClassroomSummary',
  additionalProperties: false,
})
export class ClassroomSummaryDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id: string;

  @ApiProperty({
    type: 'string',
    minLength: 3,
    maxLength: 80,
  })
  name: string;

  @ApiProperty({ type: 'string', format: 'uuid' })
  ownerId: string;

  @ApiProperty({ type: TeacherSummaryDto })
  teacher: TeacherSummaryDto | null;

  @ApiProperty({
    allOf: [{ $ref: '#/components/schemas/LastAnnouncementSummary' }],
    nullable: true,
  })
  lastAnnouncement: LastAnnouncementSummaryDto | null;
}

@closedSchema({
  name: 'ClassroomMember',
  additionalProperties: false,
})
export class ClassroomMemberDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;
}

@closedSchema({
  name: 'ClassroomWithMembers',
  additionalProperties: false,
})
export class ClassroomWithMembersDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', format: 'uuid' })
  ownerId!: string;

  @ApiProperty({
    type: 'array',
    items: { $ref: '#/components/schemas/ClassroomMember' },
  })
  members!: ClassroomMemberDto[];

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}
