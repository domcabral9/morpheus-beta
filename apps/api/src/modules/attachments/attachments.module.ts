import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsRepository } from "./attachments.repository";
import { AttachmentsService } from "./attachments.service";

@Module({
  imports: [StorageModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsRepository, AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
