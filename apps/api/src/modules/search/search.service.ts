import { Injectable } from "@nestjs/common";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { SearchRepository } from "./search.repository";

const RESULTS_PER_GROUP = 5;

function hasPermission(user: AuthenticatedUser, key: string): boolean {
  return user.permissions.includes(key);
}

export interface SearchContentResult {
  assessments: Array<{
    id: string;
    softwareName: string;
    status: string;
    areaName: string;
    updatedAt: Date;
  }>;
  inventoryItems: Array<{ id: string; name: string; status: string; areaName: string }>;
  technicalOpinions: Array<{
    id: string;
    number: string;
    classificationLabel: string;
    softwareName: string;
  }>;
}

/** Busca de conteúdo pra "Busca rápida" (Cmd/Ctrl+K) - reaproveita exatamente a mesma
 * regra de visibilidade de cada módulo (própria vs. todas as avaliações/pareceres,
 * `inventory:view` pro inventário), sem nenhuma permissão nova. Quem não tem acesso a
 * um tipo de conteúdo simplesmente recebe uma lista vazia pra ele, em vez de erro -
 * a busca deve degradar graciosamente, não travar a paleta inteira. */
@Injectable()
export class SearchService {
  constructor(private readonly repository: SearchRepository) {}

  async search(user: AuthenticatedUser, q: string): Promise<SearchContentResult> {
    // Mesmas regras de `AssessmentsService.findAllForUser` e
    // `TechnicalOpinionService.findAllForTenant`, sem nenhuma permissão nova.
    const canViewAllAssessments = hasPermission(user, PERMISSIONS.ASSESSMENTS_VIEW_ALL);
    const canViewAssessments =
      canViewAllAssessments || hasPermission(user, PERMISSIONS.ASSESSMENTS_VIEW_OWN);
    const canViewAllOpinions =
      canViewAllAssessments || hasPermission(user, PERMISSIONS.ASSESSMENTS_APPROVE);
    const canViewInventory = hasPermission(user, PERMISSIONS.INVENTORY_VIEW);

    const [assessments, inventoryItems, technicalOpinions] = await Promise.all([
      canViewAssessments
        ? this.repository.searchAssessments(
            user.tenantId,
            canViewAllAssessments ? undefined : user.id,
            q,
            RESULTS_PER_GROUP,
          )
        : [],
      canViewInventory
        ? this.repository.searchInventoryItems(user.tenantId, q, RESULTS_PER_GROUP)
        : [],
      this.repository.searchTechnicalOpinions(
        user.tenantId,
        canViewAllOpinions ? undefined : user.id,
        q,
        RESULTS_PER_GROUP,
      ),
    ]);

    return {
      assessments: assessments.map((row) => ({
        id: row.id,
        softwareName: row.softwareName,
        status: row.status,
        areaName: row.area.name,
        updatedAt: row.updatedAt,
      })),
      inventoryItems: inventoryItems.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        areaName: row.area.name,
      })),
      technicalOpinions: technicalOpinions.map((row) => ({
        id: row.id,
        number: row.number,
        classificationLabel: row.classificationLabel,
        softwareName: row.assessmentVersion.assessment.softwareName,
      })),
    };
  }
}
