import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AuditLogService } from "../audit/audit-log.service";
import { STORAGE_ADAPTER, StorageAdapter } from "../storage/storage.interface";
import { AttachmentsRepository, AttachmentDetail } from "./attachments.repository";
import { UploadAttachmentDto } from "./dto/upload-attachment.dto";
import { ListAttachmentsQueryDto } from "./dto/list-attachments.query.dto";

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly repository: AttachmentsRepository,
    private readonly auditLogService: AuditLogService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async upload(
    user: AuthenticatedUser,
    dto: UploadAttachmentDto,
    file: Express.Multer.File,
  ): Promise<AttachmentDetail> {
    this.assertExactlyOneParent(dto);

    if (dto.assessmentId) {
      await this.assertCanUploadToAssessment(user, dto.assessmentId);
    } else {
      await this.assertCanUploadToInventoryItem(user, dto.inventoryItemId!);
    }

    const nextVersion =
      (await this.repository.findMaxVersion({
        assessmentId: dto.assessmentId,
        inventoryItemId: dto.inventoryItemId,
        fileName: file.originalname,
      })) + 1;

    // Chave inclui timestamp: cada versão fica em um objeto próprio no
    // storage (nunca sobrescreve a anterior), mesmo espírito de
    // AssessmentVersion — histórico completo, não só o arquivo mais recente.
    const parentId = dto.assessmentId ?? dto.inventoryItemId;
    const storageKey = `attachments/${user.tenantId}/${parentId}/${Date.now()}-${file.originalname}`;
    await this.storage.save(storageKey, file.buffer);

    const attachment = await this.repository.create({
      tenantId: user.tenantId,
      assessmentId: dto.assessmentId,
      inventoryItemId: dto.inventoryItemId,
      category: dto.category,
      fileName: file.originalname,
      storageKey,
      version: nextVersion,
      uploadedById: user.id,
    });

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CREATE",
      entityType: "Attachment",
      entityId: attachment.id,
      metadata: { fileName: file.originalname, version: nextVersion, category: dto.category },
    });

    return attachment;
  }

  async list(user: AuthenticatedUser, query: ListAttachmentsQueryDto): Promise<AttachmentDetail[]> {
    this.assertExactlyOneParent(query);

    if (query.assessmentId) {
      await this.assertCanViewAssessment(user, query.assessmentId);
    } else {
      await this.assertCanViewInventoryItem(user, query.inventoryItemId!);
    }

    return this.repository.findMany({
      tenantId: user.tenantId,
      assessmentId: query.assessmentId,
      inventoryItemId: query.inventoryItemId,
    });
  }

  async download(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ attachment: AttachmentDetail; buffer: Buffer }> {
    const attachment = await this.repository.findById(id);
    if (!attachment) throw new NotFoundException("Anexo não encontrado.");
    if (attachment.tenantId !== user.tenantId) {
      throw new ForbiddenException("Anexo de outro tenant.");
    }

    if (attachment.assessmentId) {
      await this.assertCanViewAssessment(user, attachment.assessmentId);
    } else if (attachment.inventoryItemId) {
      await this.assertCanViewInventoryItem(user, attachment.inventoryItemId);
    }

    const buffer = await this.storage.read(attachment.storageKey);

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "DOWNLOAD",
      entityType: "Attachment",
      entityId: attachment.id,
      metadata: { fileName: attachment.fileName, version: attachment.version },
    });

    return { attachment, buffer };
  }

  // --- Helpers ------------------------------------------------------------------
  private assertExactlyOneParent(params: {
    assessmentId?: string;
    inventoryItemId?: string;
  }): void {
    if (!params.assessmentId && !params.inventoryItemId) {
      throw new BadRequestException("Informe assessmentId ou inventoryItemId.");
    }
    if (params.assessmentId && params.inventoryItemId) {
      throw new BadRequestException("Informe apenas um: assessmentId ou inventoryItemId.");
    }
  }

  private async assertCanUploadToAssessment(
    user: AuthenticatedUser,
    assessmentId: string,
  ): Promise<void> {
    const assessment = await this.repository.findAssessmentContext(assessmentId);
    if (!assessment) throw new NotFoundException("Avaliação não encontrada.");
    if (assessment.tenantId !== user.tenantId) {
      throw new ForbiddenException("Avaliação de outro tenant.");
    }
    const isRequester = assessment.requesterId === user.id;
    const canViewAll = user.permissions.includes(PERMISSIONS.ASSESSMENTS_VIEW_ALL);
    if (!isRequester && !canViewAll) {
      throw new ForbiddenException("Sem permissão para anexar documentos a esta avaliação.");
    }
  }

  private async assertCanViewAssessment(
    user: AuthenticatedUser,
    assessmentId: string,
  ): Promise<void> {
    const assessment = await this.repository.findAssessmentContext(assessmentId);
    if (!assessment) throw new NotFoundException("Avaliação não encontrada.");
    if (assessment.tenantId !== user.tenantId) {
      throw new ForbiddenException("Avaliação de outro tenant.");
    }
    const isRequester = assessment.requesterId === user.id;
    const canViewAll = user.permissions.includes(PERMISSIONS.ASSESSMENTS_VIEW_ALL);
    const canApprove = user.permissions.includes(PERMISSIONS.ASSESSMENTS_APPROVE);
    if (!isRequester && !canViewAll && !canApprove) {
      throw new ForbiddenException("Sem permissão para visualizar anexos desta avaliação.");
    }
  }

  private async assertCanUploadToInventoryItem(
    user: AuthenticatedUser,
    inventoryItemId: string,
  ): Promise<void> {
    if (!user.permissions.includes(PERMISSIONS.INVENTORY_MANAGE)) {
      throw new ForbiddenException("Sem permissão para anexar documentos ao inventário.");
    }
    const item = await this.repository.findInventoryItemContext(inventoryItemId);
    if (!item) throw new NotFoundException("Item de inventário não encontrado.");
    if (item.tenantId !== user.tenantId) throw new ForbiddenException("Item de outro tenant.");
  }

  private async assertCanViewInventoryItem(
    user: AuthenticatedUser,
    inventoryItemId: string,
  ): Promise<void> {
    if (!user.permissions.includes(PERMISSIONS.INVENTORY_VIEW)) {
      throw new ForbiddenException("Sem permissão para visualizar anexos do inventário.");
    }
    const item = await this.repository.findInventoryItemContext(inventoryItemId);
    if (!item) throw new NotFoundException("Item de inventário não encontrado.");
    if (item.tenantId !== user.tenantId) throw new ForbiddenException("Item de outro tenant.");
  }
}
