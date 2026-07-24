import { Module } from "@nestjs/common";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import { SearchRepository } from "./search.repository";

// Módulo leve, autocontido via PrismaService (global) - mesmo padrão do
// RenewalModule: consulta os dados diretamente em vez de importar
// AssessmentsModule/InventoryModule/TechnicalOpinionModule, evitando
// qualquer risco de circularidade no grafo de imports existente.
@Module({
  controllers: [SearchController],
  providers: [SearchService, SearchRepository],
})
export class SearchModule {}
