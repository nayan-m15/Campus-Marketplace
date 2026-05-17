import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  Avatar,
  BookingStatusBadge,
  Icon,
  StatusBadge,
  buildBookings,
  buildListingMatchKey,
  formatDate,
  formatDateTime,
  formatDateTimeLong,
  getItemTypeLabel,
  getStatusTone,
  initials,
  mapBookingStatusToTransactionStatus,
} from "./TradeFacilityDashboard";

vi.mock("../supabaseClient", () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));

vi.mock("../context/NotificationContext", () => ({
  useNotifications: () => ({
    notifySuccess: vi.fn(),
    notifyError: vi.fn(),
    addNotification: vi.fn(),
  }),
}));

vi.mock("../utils/messageDelivery", () => ({ insertMessage: vi.fn() }));
vi.mock("../utils/receiptPdf", () => ({ generateTransactionReceiptPdf: vi.fn() }));

describe("TradeFacilityDashboard helpers", () => {
  test("formats dates, initials, keys, statuses, and item type labels", () => {
    expect(formatDate("2026-05-17")).toMatch(/2026/);
    expect(formatDate("")).toBe("-");
    expect(formatDateTime("2026-05-17T09:30:00.000Z")).toEqual({
      date: expect.stringMatching(/2026/),
      time: expect.stringMatching(/\d{2}:\d{2}/),
    });
    expect(formatDateTime("")).toEqual({ date: "-", time: "-" });
    expect(formatDateTimeLong("2026-05-17T09:30:00.000Z")).toMatch(/2026/);
    expect(formatDateTimeLong("")).toBe("-");
    expect(initials("Campus Seller")).toBe("CS");
    expect(initials("")).toBe("?");
    expect(buildListingMatchKey("user-1", " Desk Lamp ")).toBe("user-1::desk lamp");
    expect(getItemTypeLabel({ transaction_type: "item_trade" })).toBe("Item Trade");
    expect(getItemTypeLabel({ offered_listing_id: "listing-2" })).toBe("Item Trade");
    expect(getItemTypeLabel({ transaction_type: "sale" })).toBe("Sale");
    expect(getStatusTone("completed")).toBe("success");
    expect(getStatusTone("awaiting_dropoff")).toBe("warning");
    expect(getStatusTone("cancelled")).toBe("danger");
    expect(getStatusTone("awaiting_collection")).toBe("info");
    expect(getStatusTone("unknown")).toBe("neutral");
    expect(mapBookingStatusToTransactionStatus("dropoff", "scheduled", "pending")).toBe("awaiting_dropoff");
    expect(mapBookingStatusToTransactionStatus("collection", "scheduled", "pending")).toBe("awaiting_collection");
    expect(mapBookingStatusToTransactionStatus("trade_meetup", "scheduled", "awaiting_meetup")).toBe("awaiting_meetup");
    expect(mapBookingStatusToTransactionStatus("dropoff", "cancelled", "awaiting_payment")).toBe("awaiting_payment");
  });

  test("builds sorted drop-off, collection, and meetup booking rows", () => {
    const profilesById = {
      seller: { display_name: "Seller Person", email: "seller@example.com" },
      buyer: { name: "Buyer Person", email: "buyer@example.com" },
    };
    const bookingsById = {
      dropoff: {
        id: "dropoff",
        scheduled_time: "2026-05-17T09:00:00.000Z",
        status: "scheduled",
        location: "Main Desk",
      },
      collection: {
        id: "collection",
        scheduled_time: "2026-05-18T10:00:00.000Z",
        status: "completed",
        location: "Collection Desk",
      },
      meetup: {
        id: "meetup",
        scheduled_time: "2026-05-16T08:30:00.000Z",
        status: "pending_approval",
        location: "Trade Desk",
      },
    };
    const rows = buildBookings(
      [
        {
          id: "txn-sale",
          item: "Desk Lamp",
          seller_id: "seller",
          buyer_id: "buyer",
          status: "awaiting_collection",
          dropoff_id: "dropoff",
          collection_id: "collection",
        },
        {
          id: "txn-trade",
          item: "Desk Lamp for Ball",
          seller_id: "seller",
          buyer_id: "buyer",
          status: "awaiting_meetup",
          transaction_type: "item_trade",
          trade_meetup_id: "meetup",
        },
      ],
      profilesById,
      bookingsById,
    );

    expect(rows.map((row) => row.id)).toEqual(["meetup", "dropoff", "collection"]);
    expect(rows[0]).toMatchObject({
      type: "trade_meetup",
      role: "both",
      personName: "Seller Person",
      location: "Trade Desk",
    });
    expect(rows[1]).toMatchObject({
      type: "dropoff",
      personName: "Seller Person",
      studentId: "seller@example.com",
      status: "scheduled",
      itemName: "Desk Lamp",
      location: "Main Desk",
    });
    expect(rows[2]).toMatchObject({
      type: "collection",
      personName: "Buyer Person",
      studentId: "buyer@example.com",
      status: "completed",
      location: "Main Desk",
    });
  });

  test("renders helper badges, avatar, and icons with fallbacks", () => {
    render(
      <section>
        <StatusBadge status="awaiting_payment" />
        <StatusBadge status="custom_status" />
        <BookingStatusBadge status="scheduled" />
        <BookingStatusBadge status="custom_booking" />
        <Avatar name="Campus Seller" size="lg" />
        <Icon name="users" title="Users icon" />
        <Icon name="missing-icon" title="Fallback icon" />
      </section>,
    );

    expect(screen.getByText("Awaiting Payment")).toBeInTheDocument();
    expect(screen.getByText("custom_status")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("custom_booking")).toBeInTheDocument();
    expect(screen.getByText("CS")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /users icon/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /fallback icon/i })).toBeInTheDocument();
  });
});
