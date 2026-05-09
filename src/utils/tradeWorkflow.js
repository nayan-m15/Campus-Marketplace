export const TRANSACTION_STATUS_META = {
  pending: "Pending",
  awaiting_dropoff: "Awaiting Drop-off",
  item_received: "Item Received",
  collection_pending_approval: "Collection Pending Approval",
  awaiting_collection: "Awaiting Collection",
  item_released: "Item Released",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function buildTradeTransactionId(prefix = "TXN") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function canBookCollectionForStatus(status) {
  // `collection_pending_approval` is a legacy UI alias; it should never be
  // written to `transactions.status`, but we still recognize it defensively.
  return [
    "item_received",
    "collection_pending_approval",
    "awaiting_collection",
  ].includes(status);
}

export function deriveBookingStatus(type, transactionStatus, persistedBookingStatus = null) {
  if (persistedBookingStatus === "cancelled") return "cancelled";
  if (persistedBookingStatus === "pending_approval") return "pending_approval";
  if (transactionStatus === "cancelled") return "cancelled";

  if (type === "dropoff") {
    return ["awaiting_collection", "item_received", "item_released", "completed"].includes(transactionStatus)
      ? "completed"
      : persistedBookingStatus || "scheduled";
  }

  if (transactionStatus === "collection_pending_approval") {
    return "pending_approval";
  }

  return ["item_released", "completed"].includes(transactionStatus)
    ? "completed"
    : persistedBookingStatus || "scheduled";
}

export function getDropoffStageLabel(transaction) {
  if (!transaction) return "";

  if (!transaction.dropoff_booking) {
    return "Waiting for seller drop-off booking";
  }

  if (["awaiting_dropoff", "pending"].includes(transaction.status)) {
    if (transaction.dropoff_booking.status === "pending_approval") {
      return "Drop-off request pending approval";
    }

    return "Awaiting seller drop-off completion";
  }

  return "Drop-off completed";
}

export function getCollectionStageLabel(transaction) {
  if (!transaction) return "";

  if (["item_released", "completed"].includes(transaction.status)) {
    return "Collection completed";
  }

  if (!transaction.collection_booking) {
    return canBookCollectionForStatus(transaction.status)
      ? "Waiting for buyer collection booking"
      : "Collection not available yet";
  }

  if (transaction.collection_booking.status === "pending_approval") {
    return "Collection request pending approval";
  }

  if (transaction.status === "awaiting_collection") {
    return "Collection scheduled";
  }

  return "Collection scheduled";
}
