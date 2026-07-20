import { Injectable } from "@nestjs/common";
import { Area } from "@morpheus/database";
import { AreasRepository } from "./areas.repository";

@Injectable()
export class AreasService {
  constructor(private readonly areasRepository: AreasRepository) {}

  findAllActive(tenantId: string): Promise<Area[]> {
    return this.areasRepository.findAllActive(tenantId);
  }
}
