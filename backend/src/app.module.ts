import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ClassroomsModule } from './classrooms/classrooms.module';
import { InvitesCodeModule } from './invites-code/invites-code.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    AnnouncementsModule,
    ClassroomsModule,
    InvitesCodeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
