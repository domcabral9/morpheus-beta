import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { PrometheusController } from "@willsoto/nestjs-prometheus";
import { Public } from "../decorators/public.decorator";

/**
 * Substitui o controller padrão do PrometheusModule só para marcar a rota
 * como pública — o guard global (JwtAuthGuard) protegeria /metrics por
 * padrão, e um scraper do Prometheus não tem (nem deveria ter) um JWT da
 * aplicação.
 */
@Public()
@Controller()
export class MetricsController extends PrometheusController {
  @Get()
  override index(@Res({ passthrough: true }) response: Response) {
    return super.index(response);
  }
}
