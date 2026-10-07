import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InstallationCapabilityGuard } from './guards/installation-capability.guard';
import { pushConfig } from './push.config';
import { PushRegistrationService } from './push-registration.service';
import { PushController } from './push.controller';
import { ExpoPushAdapter } from './expo-push.adapter';
import { PushTestService } from './push-test.service';
import { PushReceiptsWorker } from './push-receipts.worker';
import { announcementPushConfig } from './announcement-push.config';
import { AnnouncementPushService } from './announcement-push.service';
import { AnnouncementPushWorker } from './announcement-push.worker';
import { AnnouncementRemindersWorker } from './announcement-reminders.worker';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forFeature(pushConfig),
    ConfigModule.forFeature(announcementPushConfig),
  ],
  controllers: [PushController],
  providers: [
    InstallationCapabilityGuard,
    PushRegistrationService,
    ExpoPushAdapter,
    PushTestService,
    PushReceiptsWorker,
    AnnouncementPushService,
    AnnouncementPushWorker,
    AnnouncementRemindersWorker,
  ],
  exports: [
    InstallationCapabilityGuard,
    PushRegistrationService,
    PushTestService,
    PushReceiptsWorker,
  ],
})
export class PushModule {}
