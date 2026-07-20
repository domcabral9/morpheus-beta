export const STORAGE_ADAPTER = Symbol("STORAGE_ADAPTER");

/**
 * Abstração de armazenamento de arquivos gerados (pareceres em PDF, e
 * futuramente anexos — Etapa 11). A API nunca serve arquivos por URL pública
 * direta: sempre por um endpoint autenticado que lê via `read()` e faz
 * streaming — assim um adapter S3 privado (bucket sem acesso público) atende
 * exatamente o mesmo contrato do adapter de disco local usado em dev, sem
 * precisar de URLs pré-assinadas nem expor `getPublicUrl()`.
 */
export interface StorageAdapter {
  save(key: string, buffer: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
}
