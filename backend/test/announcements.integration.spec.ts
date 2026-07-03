import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from '@prisma/client';

type AuthResponse = {
  id: string;
  access_token: string;
  refresh_token: string;
};

describe('Announcements Integration Tests', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testPrefix = `announcements-integration-${Date.now()}`;
  const testPassword = '12345678';

  const makeEmail = (label: string) => `${testPrefix}-${label}@example.com`;
  const makeClassroomName = (label: string) =>
    `${testPrefix}-${label}`.toUpperCase();
  const makeInviteCode = (email: string) =>
    `PROF-${email.replace(/[^a-zA-Z0-9]/g, '-')}`;

  const deleteTestData = async () => {
    await prisma.announcement.deleteMany({
      where: {
        classroom: { name: { startsWith: testPrefix, mode: 'insensitive' } },
      },
    });
    await prisma.userClassroom.deleteMany({
      where: {
        classroom: { name: { startsWith: testPrefix, mode: 'insensitive' } },
      },
    });
    await prisma.classroom.deleteMany({
      where: { name: { startsWith: testPrefix, mode: 'insensitive' } },
    });
    await prisma.inviteCode.deleteMany({
      where: {
        code: { startsWith: `PROF-${testPrefix}`, mode: 'insensitive' },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: testPrefix, mode: 'insensitive' } },
    });
  };

  const createProfessor = async (email: string) => {
    const inviteCode = await prisma.inviteCode.create({
      data: {
        code: makeInviteCode(email),
        role: Role.PROFESSOR,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const profRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Prof User',
        email,
        password: testPassword,
        teacherCode: inviteCode.code,
      })
      .expect(201);

    return profRes.body as AuthResponse;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = app.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await deleteTestData();
  });

  afterAll(async () => {
    await deleteTestData();
    await app.close();
  });

  describe('POST /api/v1/announcements', () => {
    it('should create announcement as professor', async () => {
      // 1. Create professor
      const profEmail = makeEmail('professor');
      const profToken = (await createProfessor(profEmail)).access_token;

      // 2. Create classroom
      const classroomRes = await request(app.getHttpServer())
        .post('/api/v1/classrooms')
        .set('Authorization', `Bearer ${profToken}`)
        .send({ name: makeClassroomName('room1') });

      const classroomId = (classroomRes.body as Record<string, unknown>).id;

      // 3. Create announcement
      const announcementRes = await request(app.getHttpServer())
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${profToken}`)
        .send({
          title: 'Test Announcement',
          content: 'Test Content',
          durationInDays: 7,
          classroomId,
        })
        .expect(201);

      expect(announcementRes.body).toHaveProperty('id');
      expect((announcementRes.body as Record<string, unknown>).title).toBe(
        'Test Announcement',
      );
    });

    it('should not allow student to create announcement', async () => {
      // 1. Create professor and create classroom
      const profEmail = makeEmail('professor');
      const profToken = (await createProfessor(profEmail)).access_token;

      const classroomRes = await request(app.getHttpServer())
        .post('/api/v1/classrooms')
        .set('Authorization', `Bearer ${profToken}`)
        .send({ name: makeClassroomName('room2') });

      const classroomId = (classroomRes.body as Record<string, unknown>).id;

      // 2. Register student
      const studentEmail = makeEmail('student');
      const studentRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Student User',
          email: studentEmail,
          password: testPassword,
        });

      const studentToken = (studentRes.body as AuthResponse).access_token;

      // 3. Tries to create announcement as student
      await request(app.getHttpServer())
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Unauthorized',
          content: 'Content',
          durationInDays: 7,
          classroomId,
        })
        .expect(403); // Forbidden
    });

    it('should not allow duration outside the accepted options', async () => {
      const profEmail = makeEmail('prof-invalid');
      const profToken = (await createProfessor(profEmail)).access_token;

      const classroomRes = await request(app.getHttpServer())
        .post('/api/v1/classrooms')
        .set('Authorization', `Bearer ${profToken}`)
        .send({ name: makeClassroomName('invalid-duration') });

      const classroomId = (classroomRes.body as Record<string, unknown>).id;

      await request(app.getHttpServer())
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${profToken}`)
        .send({
          title: 'Invalid Duration',
          content: 'Content',
          durationInDays: 2,
          classroomId,
        })
        .expect(400);
    });

    it('should not allow more than 10 active announcements in a classroom', async () => {
      const professor = await createProfessor(makeEmail('professor-limit'));
      const profToken = professor.access_token;

      const classroomRes = await request(app.getHttpServer())
        .post('/api/v1/classrooms')
        .set('Authorization', `Bearer ${profToken}`)
        .send({ name: makeClassroomName('limit') });

      const classroomId = (classroomRes.body as Record<string, unknown>)
        .id as string;

      for (let index = 1; index <= 10; index += 1) {
        await request(app.getHttpServer())
          .post('/api/v1/announcements')
          .set('Authorization', `Bearer ${profToken}`)
          .send({
            title: `Announcement ${index}`,
            content: 'Content',
            durationInDays: 7,
            classroomId,
          })
          .expect(201);
      }

      await request(app.getHttpServer())
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${profToken}`)
        .send({
          title: 'Announcement 11',
          content: 'Content',
          durationInDays: 7,
          classroomId,
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/announcements', () => {
    it('should list announcements for user in classroom', async () => {
      // Setup: create professor, classroom, and announcement
      const profEmail = makeEmail('professor');
      const profToken = (await createProfessor(profEmail)).access_token;

      const classroomRes = await request(app.getHttpServer())
        .post('/api/v1/classrooms')
        .set('Authorization', `Bearer ${profToken}`)
        .send({ name: makeClassroomName('room3') });

      const classroomId = (classroomRes.body as Record<string, unknown>).id;

      await request(app.getHttpServer())
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${profToken}`)
        .send({
          title: 'Announcement 1',
          content: 'Content',
          durationInDays: 7,
          classroomId,
        });

      // Get announcements
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/announcements')
        .set('Authorization', `Bearer ${profToken}`)
        .expect(200);

      expect(Array.isArray(listRes.body)).toBe(true);
      expect((listRes.body as Array<unknown>).length).toBeGreaterThan(0);
      expect((listRes.body as Array<Record<string, unknown>>)[0].title).toBe(
        'Announcement 1',
      );
      expect(
        (listRes.body as Array<{ author: { name: string } }>)[0]?.author.name,
      ).toBe('Prof User');
    });

    it('should list announcements for a parent after joining classroom', async () => {
      const profEmail = makeEmail('professor-parent-view');
      const profToken = (await createProfessor(profEmail)).access_token;

      const classroomRes = await request(app.getHttpServer())
        .post('/api/v1/classrooms')
        .set('Authorization', `Bearer ${profToken}`)
        .send({ name: makeClassroomName('parent-view') });

      const classroomId = (classroomRes.body as Record<string, unknown>)
        .id as string;

      await request(app.getHttpServer())
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${profToken}`)
        .send({
          title: 'Parent Visible Announcement',
          content: 'Content',
          durationInDays: 7,
          classroomId,
        })
        .expect(201);

      const parentRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Parent User',
          email: makeEmail('parent'),
          password: testPassword,
        })
        .expect(201);

      const parentToken = (parentRes.body as AuthResponse).access_token;

      await request(app.getHttpServer())
        .post(`/api/v1/classrooms/${classroomId}/join`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(201);

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/announcements')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect((listRes.body as Array<Record<string, unknown>>)[0].title).toBe(
        'Parent Visible Announcement',
      );
    });
  });
});
