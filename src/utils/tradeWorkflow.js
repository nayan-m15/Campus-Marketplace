export const TRANSACTION_STATUS_META = {
  pending: "Pending",
  awaiting_dropoff: "Awaiting Drop-off",
  dropped_off: "Dropped Off",
  item_received: "Item Received",
  collection_pending_approval: "Collection Pending Approval",
  awaiting_collection: "Awaiting Collection",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function buildTradeTransactionId(prefix = "TXN") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function canBookCollectionForStatus(status) {
  return [
    "dropped_off",
    "item_received",
    "collection_pending_approval",
    "awaiting_collection",
  ].includes(status);
}

export function deriveBookingStatus(type, transactionStatus) {
  if (transactionStatus === "cancelled") return "cancelled";
  if (type === "dropoff") {
    return ["awaiting_collection", "item_received", "completed"].includes(transactionStatus)
      ? "completed"
      : "scheduled";
  }

  if (transactionStatus === "collection_pending_approval") {
    return "pending_approval";
  }

  return transactionStatus === "completed" ? "completed" : "scheduled";
}
