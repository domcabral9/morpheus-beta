import { Global, Module } from "@nestjs/common";
import { SIEM_ADAPTER } from "./siem/siem.interface";
import { WebhookSiemAdapter } from "./siem/webhook-siem.adapter";
import { ITSM_ADAPTER } from "./itsm/itsm.interface";
import { WebhookItsmAdapter } from "./itsm/webhook-itsm.adapter";
import { COLLABORATION_ADAPTER } from "./collaboration/collaboration.interface";
import { WebhookCollaborationAdapter } from "./collaboration/webhook-collaboration.adapter";

/** Global como NotificationsModule/AuditLogModule — os três adapters são consumidos por outros módulos de negócio. */
@Global()
@Module({
  providers: [
    { provide: SIEM_ADAPTER, useClass: WebhookSiemAdapter },
    { provide: ITSM_ADAPTER, useClass: WebhookItsmAdapter },
    { provide: COLLABORATION_ADAPTER, useClass: WebhookCollaborationAdapter },
  ],
  exports: [SIEM_ADAPTER, ITSM_ADAPTER, COLLABORATION_ADAPTER],
})
export class IntegrationsModule {}
