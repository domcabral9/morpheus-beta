import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { TechnicalOpinionService } from "./technical-opinion.service";
import { ListTechnicalOpinionsQueryDto } from "./dto/list-technical-opinions.query.dto";

@ApiTags("technical-opinions")
@Controller("technical-opinions")
export class TechnicalOpinionController {
  constructor(private readonly technicalOpinionService: TechnicalOpinionService) {}

  // Sem @RequirePermissions: a visibilidade (própria vs. todas) depende dos
  // permissions do usuário, resolvida dentro do service (mesmo padrão do
  // GET /assessments — ver findAllForTenant).
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListTechnicalOpinionsQueryDto) {
    return this.technicalOpinionService.findAllForTenant(user, query);
  }

  @Get("assessments/:assessmentId")
  getLatestForAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("assessmentId") assessmentId: string,
  ) {
    return this.technicalOpinionService.getLatestForAssessment(user, assessmentId);
  }

  @Get(":id/download")
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const { opinion, buffer } = await this.technicalOpinionService.getPdfForDownload(user, id);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${opinion.number}.pdf"`,
      "Content-Length": String(buffer.length),
    });
    res.send(buffer);
  }

  /** Página de verificação pública apontada pelo QR Code — sem autenticação de propósito. */
  @Public()
  @Get("verify/:tenantSlug/:number")
  verify(@Param("tenantSlug") tenantSlug: string, @Param("number") number: string) {
    return this.technicalOpinionService.verify(tenantSlug, number);
  }
}
