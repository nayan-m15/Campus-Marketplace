import { expect, test, vi } from "vitest";
import {
  buildTradeTransactionId,
  canBookCollectionForStatus,
  deriveBookingStatus,
} from "./tradeWorkflow";

test("buildTradeTransactionId uses the prefix and an upper-case timestamp token", () => {
  vi.spyOn(Date, "now").mockReturnValue(123456789);

  expect(buildTradeTransactionId("TRADE")).toBe(`TRADE-${(123456789).toString(36).toUpperCase()}`);

  Date.now.mockRestore();
});

test("canBookCollectionForStatus only allows collection-ready statuses", () => {
  expect(canBookCollectionForStatus("item_received")).toBe(true);
  expect(canBookCollectionForStatus("collection_pending_approval")).toBe(true);
  expect(canBookCollectionForStatus("awaiting_collection")).toBe(true);
  expect(canBookCollectionForStatus("awaiting_dropoff")).toBe(false);
  expect(canBookCollectionForStatus("completed")).toBe(false);
});

test("deriveBookingStatus handles cancelled, drop-off, pending approval, and completed flows", () => {
  expect(deriveBookingStatus("dropoff", "cancelled")).toBe("cancelled");
  expect(deriveBookingStatus("dropoff", "awaiting_dropoff")).toBe("scheduled");
  expect(deriveBookingStatus("dropoff", "item_received")).toBe("completed");
  expect(deriveBookingStatus("collection", "collection_pending_approval")).toBe("pending_approval");
  expect(deriveBookingStatus("collection", "item_released")).toBe("completed");
  expect(deriveBookingStatus("collection", "awaiting_collection")).toBe("scheduled");
});
