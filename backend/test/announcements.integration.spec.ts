import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from '@prisma/client';

type AuthResponse = { access_token: string; refresh_token: string };

describe('Announcements Integration Tests', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testPrefix = `announcements-integration-${Date.now()}`;
  const testPassword = '12345678';

  const makeEmail = (label: string) => `${testPrefix}-${label}@example.com`;
  const makeClassroomName = (label: string) => `${testPrefix}-${label}`;

  const deleteTestData = async () => {
    await prisma.announcement.deleteMany({
      where: {
        classroom: { name: { startsWith: testPrefix } },
      },
    });
    await prisma.userClassroom.deleteMany({
      where: {
        classroom: { name: { startsWith: testPrefix } },
      },
    });
    await prisma.classroom.deleteMany({
      where: { name: { startsWith: testPrefix } },
    });
    await prisma.inviteCode.deleteMany({
      where: { isActive: false, role: Role.PROFESSOR },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: testPrefix } },
    });
  };

  const createProfessor = async (email: string) => {
    const inviteCode = await prisma.inviteCode.create({
      data: {
        code: `PROF-${Date.now().toString().slice(-6)}`,
        role: Role.PROFESSOR,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const profRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Prof User',
        email,
        password: testPassword,
        teacherCode: inviteCode.code,
      });

    return profRes.body as AuthResponse;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
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

  describe('POST /api/announcements', () => {
    it('should create announcement as professor', async () => {
      // 1. Create professor
      const profEmail = makeEmail('professor');
      const profToken = (await createProfessor(profEmail)).access_token;

      // 2. Create classroom
      const classroomRes = await request(app.getHttpServer())
        .post('/api/classrooms')
        .set('Authorization', `Bearer ${profToken}`)
        .send({ name: makeClassroomName('room1') });

      const classroomId = (classroomRes.body as Record<string, unknown>).id;

      // 3. Create announcement
      const announcementRes = await request(app.getHttpServer())
        .post('/api/announcements')
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
        .post('/api/classrooms')
        .set('Authorization', `Bearer ${profToken}`)
        .send({ name: makeClassroomName('room2') });

      const classroomId = (classroomRes.body as Record<string, unknown>).id;

      // 2. Register student
      const studentEmail = makeEmail('student');
      const studentRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Student User',
          email: studentEmail,
          password: testPassword,
        });

      const studentToken = (studentRes.body as AuthResponse).access_token;

      // 3. Tries to create announcement as student
      await request(app.getHttpServer())
        .post('/api/announcements')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Unauthorized',
          content: 'Content',
          durationInDays: 7,
          classroomId,
        })
        .expect(403); // Forbidden
    });
  });

  describe('GET /api/announcements', () => {
    it('should list announcements for user in classroom', async () => {
      // Setup: create professor, classroom, and announcement
      const profEmail = makeEmail('professor');
      const profToken = (await createProfessor(profEmail)).access_token;

      const classroomRes = await request(app.getHttpServer())
        .post('/api/classrooms')
        .set('Authorization', `Bearer ${profToken}`)
        .send({ name: makeClassroomName('room3') });

      const classroomId = (classroomRes.body as Record<string, unknown>).id;

      await request(app.getHttpServer())
        .post('/api/announcements')
        .set('Authorization', `Bearer ${profToken}`)
        .send({
          title: 'Announcement 1',
          content: 'Content',
          durationInDays: 7,
          classroomId,
        });

      // Get announcements
      const listRes = await request(app.getHttpServer())
        .get('/api/announcements')
        .set('Authorization', `Bearer ${profToken}`)
        .expect(200);

      expect(Array.isArray(listRes.body)).toBe(true);
      expect((listRes.body as Array<unknown>).length).toBeGreaterThan(0);
      expect((listRes.body as Array<Record<string, unknown>>)[0].title).toBe(
        'Announcement 1',
      );
    });
  });
});
