import type { InventoryItemDetail } from "@/lib/inventory-types";

/** Item na fila de `/inventory/pending-approvals` - sempre tem
 * `approvalRequest` preenchido (a própria query do backend filtra por
 * `status: PENDING_APPROVAL`), mas o tipo de `InventoryItemDetail` mantém o
 * campo nullable porque isso não é verdade fora dessa fila. */
export type PendingInventoryApproval = InventoryItemDetail;

export interface DecideInventoryApprovalPayload {
  notes?: string;
}
