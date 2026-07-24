import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { SearchService } from "./search.service";
import { SearchContentQueryDto } from "./dto/search-content.query.dto";

@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // Sem @RequirePermissions: cada tipo de conteúdo é filtrado individualmente
  // dentro do service, com a mesma regra de visibilidade do módulo de origem
  // (ver SearchService) - não é um "tem ou não tem X" único pra rota inteira.
  @Get()
  search(@CurrentUser() user: AuthenticatedUser, @Query() query: SearchContentQueryDto) {
    return this.searchService.search(user, query.q);
  }
}
