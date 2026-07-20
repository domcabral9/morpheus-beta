import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ControlsService } from "./controls.service";
import { ListControlsQueryDto } from "./dto/list-controls.query.dto";

/**
 * Catálogo global (não tenant-scoped) de frameworks/controles de
 * conformidade — leitura aberta a qualquer usuário autenticado, igual à
 * listagem de categorias do questionário. Não tem CRUD via API: é mantido
 * pelo seed, mesmo tratamento dado ao catálogo de Permission.
 */
@ApiTags("controls")
@Controller("controls")
export class ControlsController {
  constructor(private readonly controlsService: ControlsService) {}

  @Get("frameworks")
  listFrameworks() {
    return this.controlsService.listFrameworks();
  }

  @Get()
  listControls(@Query() query: ListControlsQueryDto) {
    return this.controlsService.listControls(query.frameworkId);
  }
}
