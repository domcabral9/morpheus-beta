import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsRepository } from "./attachments.repository";
import { AttachmentsService } from "./attachments.service";

@Module({
  imports: [StorageModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsRepository, AttachmentsService],
  // AttachmentsRepository é exportado além do Service pra permitir leitura
  // direta (sem checagem de permissão de usuário) pela varredura noturna de
  // reputação de inventário (ReputationService), que roda sem ator humano.
  exports: [AttachmentsRepository, AttachmentsService],
})
export class AttachmentsModule {}
