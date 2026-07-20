import { Injectable } from "@nestjs/common";
import {
  ControlsRepository,
  ControlDetail,
  ControlFrameworkWithCount,
} from "./controls.repository";

@Injectable()
export class ControlsService {
  constructor(private readonly controlsRepository: ControlsRepository) {}

  listFrameworks(): Promise<ControlFrameworkWithCount[]> {
    return this.controlsRepository.findFrameworks();
  }

  listControls(frameworkId?: string): Promise<ControlDetail[]> {
    return this.controlsRepository.findControls(frameworkId);
  }

  findById(id: string): Promise<ControlDetail | null> {
    return this.controlsRepository.findControlById(id);
  }
}
