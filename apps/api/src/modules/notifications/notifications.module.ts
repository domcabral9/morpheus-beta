import { Global, Module } from "@nestjs/common";
import { EMAIL_ADAPTER } from "./email.interface";
import { SmtpEmailAdapter } from "./smtp-email.adapter";
import { NotificationsController } from "./notifications.controller";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

/** Global como AuditLogModule/PrismaModule — usado por praticamente todo módulo de negócio. */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    NotificationsService,
    { provide: EMAIL_ADAPTER, useClass: SmtpEmailAdapter },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
