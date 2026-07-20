import { Module } from "@nestjs/common";
import { STORAGE_ADAPTER } from "./storage.interface";
import { LocalDiskStorageAdapter } from "./local-disk-storage.adapter";

@Module({
  providers: [{ provide: STORAGE_ADAPTER, useClass: LocalDiskStorageAdapter }],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
