import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import type { StorageAdapter } from "./storage.interface";

/**
 * Implementação de dev/on-premises simples do StorageAdapter: grava em disco
 * sob `STORAGE_DIR`. Trocar para um adapter S3 em produção (Etapa 16) é só
 * implementar a mesma interface — nada que consome `StorageAdapter` muda.
 */
@Injectable()
export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly baseDir: string;

  constructor(private readonly configService: ConfigService) {
    this.baseDir = resolve(this.configService.get<string>("STORAGE_DIR", "./storage"));
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    const filePath = this.resolveKey(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
  }

  async read(key: string): Promise<Buffer> {
    const filePath = this.resolveKey(key);
    return readFile(filePath);
  }

  /** Resolve `key` contra `baseDir` e recusa qualquer tentativa de escapar dele (path traversal). */
  private resolveKey(key: string): string {
    const filePath = resolve(join(this.baseDir, normalize(key)));
    if (filePath !== this.baseDir && !filePath.startsWith(this.baseDir + sep)) {
      throw new InternalServerErrorException("Chave de armazenamento inválida.");
    }
    return filePath;
  }
}
