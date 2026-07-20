import { ForbiddenException, Injectable } from "@nestjs/common";

/**
 * Primitiva de Separação de Funções (SoD): quem solicitou uma avaliação não
 * pode ser quem a aprova. É um serviço isolado (em vez de lógica embutida no
 * WorkflowService) porque a regra é a mesma em qualquer ponto de decisão do
 * sistema que precise dela — hoje só o workflow de aprovação (Etapa 6), mas
 * a regra em si não depende de nenhum conceito de workflow.
 */
@Injectable()
export class SeparationOfDutiesService {
  /**
   * @throws ForbiddenException se `actingUserId` for a mesma pessoa que `requesterId`.
   */
  assertNotSelfApproval(requesterId: string, actingUserId: string, action = "aprovar"): void {
    if (requesterId === actingUserId) {
      throw new ForbiddenException(
        `Separação de funções: quem solicitou não pode ${action} a própria avaliação.`,
      );
    }
  }
}
