/* v8 ignore file */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { insertMessage } from "../utils/messageDelivery";
import { deriveBookingStatus } from "../utils/tradeWorkflow";
import ReceiptModal from "./ReceiptModal";
import { generateTransactionReceiptPdf } from "../utils/receiptPdf";
import { useNotifications } from "../context/NotificationContext";
import "../styles/TradeFacilityDashboard.css";

const STATUS_META = {
  awaiting_payment:           { label: "Awaiting Payment", cls: "status--awaiting-payment", icon: "receipt" },
  awaiting_dropoff:            { label: "Awaiting Drop-off", cls: "status--awaiting-dropoff", icon: "clock" },
  item_received:               { label: "Item Received", cls: "status--item-received", icon: "package" },
  collection_pending_approval: { label: "Collection Pending Approval", cls: "status--awaiting-collection", icon: "clipboard" },
  awaiting_collection:         { label: "Awaiting Collection", cls: "status--awaiting-collection", icon: "bell" },
  item_released:               { label: "Item Released", cls: "status--completed", icon: "handoff" },
  completed:                   { label: "Completed", cls: "status--completed", icon: "check-circle" },
  cancelled:                   { label: "Cancelled", cls: "status--cancelled", icon: "x-circle" },
  awaiting_meetup:             { label: "Awaiting Meetup", cls: "status--awaiting-dropoff", icon: "users" },
};

const BOOKING_STATUS_META = {
  scheduled: { label: "Scheduled", cls: "bstatus--scheduled" },
  pending_approval: { label: "Pending Approval", cls: "bstatus--scheduled" },
  completed: { label: "Completed", cls: "bstatus--completed" },
  cancelled: { label: "Cancelled", cls: "bstatus--no-show" },
};

const MANAGED_STATUSES = ["awaiting_payment", "awaiting_dropoff", "item_received", "awaiting_collection", "item_released", "awaiting_meetup"];

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "grid" },
  { key: "dropoffs", label: "Drop-off Bookings", icon: "arrow-down" },
  { key: "collections", label: "Collection Bookings", icon: "arrow-up" },
  { key: "manage", label: "Manage Bookings", icon: "settings" },
  { key: "transactions", label: "Transaction Ledger", icon: "table" },
  { key: "meetups", label: "Trade Meetups", icon: "users" },
];

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(timestamp) {
  if (!timestamp) return { date: "-", time: "-" };
  const date = new Date(timestamp);
  return {
    date: date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function formatDateTimeLong(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function initials(name) {
  return (name || "?").split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
}

export function buildListingMatchKey(userId, itemName) {
  return `${userId || ""}::${String(itemName || "").trim().toLowerCase()}`;
}

export function getItemTypeLabel(transaction) {
  return transaction.transaction_type === "item_trade" || Boolean(transaction.offered_listing_id)
    ? "Item Trade"
    : "Sale";
}

export function getStatusTone(status) {
  if (["completed", "item_released"].includes(status)) return "success";
  if (["awaiting_dropoff", "collection_pending_approval"].includes(status)) return "warning";
  if (status === "cancelled") return "danger";
  if (["awaiting_collection", "item_received"].includes(status)) return "info";
  return "neutral";
}

export function mapBookingStatusToTransactionStatus(type, bookingStatus, currentStatus) {
  if (bookingStatus !== "scheduled") return currentStatus;
  if (type === "dropoff") return "awaiting_dropoff";
  if (type === "collection") return "awaiting_collection";
  return currentStatus;
}

export function buildBookings(transactions, profilesById, bookingsById) {
  const output = [];

  for (const transaction of transactions) {
    const sellerProfile = profilesById[transaction.seller_id] || {};
    const buyerProfile = profilesById[transaction.buyer_id] || {};
    const isItemTrade = transaction.transaction_type === "item_trade" || Boolean(transaction.offered_listing_id);
    const dropoffBooking = transaction.dropoff_id ? bookingsById[transaction.dropoff_id] : null;

    if (transaction.dropoff_id && dropoffBooking) {
      const booking = dropoffBooking;
      const when = formatDateTime(booking.scheduled_time);
      output.push({
        id: booking.id,
        type: "dropoff",
        transactionId: transaction.id,
        personName: sellerProfile.display_name || sellerProfile.name || transaction.seller_id,
        studentId: sellerProfile.email || transaction.seller_id,
        role: "seller",
        scheduledDate: booking.scheduled_time?.slice(0, 10) || "",
        scheduledTime: booking.scheduled_time?.slice(11, 16) || when.time,
        status: booking.status || deriveBookingStatus("dropoff", transaction.status),
        itemName: transaction.item,
        location: booking.location,
      });
    }

    if (transaction.collection_id && bookingsById[transaction.collection_id]) {
      const booking = bookingsById[transaction.collection_id];
      const when = formatDateTime(booking.scheduled_time);
      output.push({
        id: booking.id,
        type: "collection",
        transactionId: transaction.id,
        personName: buyerProfile.display_name || buyerProfile.name || transaction.buyer_id,
        studentId: buyerProfile.email || transaction.buyer_id,
        role: "buyer",
        scheduledDate: booking.scheduled_time?.slice(0, 10) || "",
        scheduledTime: booking.scheduled_time?.slice(11, 16) || when.time,
        status: booking.status || deriveBookingStatus("collection", transaction.status),
        itemName: transaction.item,
        location: !isItemTrade && dropoffBooking?.location ? dropoffBooking.location : booking.location,
      });
    }

    if (transaction.trade_meetup_id && bookingsById[transaction.trade_meetup_id]) {
      const booking = bookingsById[transaction.trade_meetup_id];
      const when = formatDateTime(booking.scheduled_time);
      output.push({
        id: booking.id,
        type: "trade_meetup",
        transactionId: transaction.id,
        personName: sellerProfile.display_name || sellerProfile.name || transaction.seller_id,
        studentId: sellerProfile.email || transaction.seller_id,
        role: "both",
        scheduledDate: booking.scheduled_time?.slice(0, 10) || "",
        scheduledTime: booking.scheduled_time?.slice(11, 16) || when.time,
        status: booking.status,
        itemName: transaction.item,
        location: booking.location,
      });
    }
  }

  return output.sort((a, b) => {
    const aTime = new Date(`${a.scheduledDate}T${a.scheduledTime || "00:00"}`);
    const bTime = new Date(`${b.scheduledDate}T${b.scheduledTime || "00:00"}`);
    return aTime - bTime;
  });
}

export function Icon({ name, className = "", title }) {
  const icons = {
    grid: (
      <path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z" />
    ),
    "arrow-down": (
      <path d="M12 4v13m0 0 5-5m-5 5-5-5" />
    ),
    "arrow-up": (
      <path d="M12 20V7m0 0 5 5m-5-5-5 5" />
    ),
    settings: (
      <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.36-6.36-2.12 2.12M7.76 16.24l-2.12 2.12m0-12.72 2.12 2.12m8.48 8.48 2.12 2.12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    ),
    table: (
      <path d="M4 6h16v12H4zM4 10h16M9 6v12M15 6v12" />
    ),
    clock: (
      <path d="M12 7v5l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    ),
    package: (
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18m8-13.5-8 4.5-8-4.5" />
    ),
    clipboard: (
      <path d="M9 4h6m-5 0a1 1 0 0 0-1 1v1h6V5a1 1 0 0 0-1-1m-4 0h4m-7 3h10a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1Z" />
    ),
    bell: (
      <path d="M15 17H9m10-1H5l1.4-1.4A2 2 0 0 0 7 13.2V11a5 5 0 1 1 10 0v2.2a2 2 0 0 0 .6 1.4L19 16Z" />
    ),
    handoff: (
      <path d="M8 12h4a2 2 0 1 0 0-4H9m3 4 1.5 1.5a2.1 2.1 0 0 0 2.97 0L20 10m-9 4H8l-3 3m0 0H3m2 0v2" />
    ),
    "check-circle": (
      <path d="m8.5 12 2.5 2.5 4.5-5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    ),
    "x-circle": (
      <path d="m9 9 6 6m0-6-6 6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    ),
    menu: (
      <path d="M4 7h16M4 12h16M4 17h16" />
    ),
    close: (
      <path d="m6 6 12 12M18 6 6 18" />
    ),
    search: (
      <path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
    ),
    receipt: (
      <path d="M7 4h10v16l-2.5-1.5L12 20l-2.5-1.5L7 20V4Zm3 4h4m-4 4h4" />
    ),
    calendar: (
      <path d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" />
    ),
    copy: (
      <path d="M9 9h10v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    ),
    "chevron-down": (
      <path d="m6 9 6 6 6-6" />
    ),
    more: (
      <path d="M12 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
    ),
    activity: (
      <path d="M4 13h4l2-6 4 10 2-4h4" />
    ),
    sun: (
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.64 5.64l1.77 1.77m9.18 9.18 1.77 1.77m0-12.72-1.77 1.77m-9.18 9.18-1.77 1.77M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
    ),
    moon: (
      <path d="M20 14.5A7.5 7.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />
    ),
    users: (
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 14v-2a4 4 0 0 0-3-3.87M15 4a3 3 0 0 1 0 6" />
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {icons[name] || icons.grid}
    </svg>
  );
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, cls: "", icon: "grid" };
  return (
    <span className={`status-badge ${meta.cls}`}>
      <Icon name={meta.icon} className="status-badge__icon" />
      {meta.label}
    </span>
  );
}

export function BookingStatusBadge({ status }) {
  const meta = BOOKING_STATUS_META[status] || { label: status, cls: "" };
  return <span className={`booking-status-badge ${meta.cls}`}>{meta.label}</span>;
}

export function Avatar({ name, size = "md" }) {
  return (
    <span className={`avatar avatar--${size}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <section className="empty-state" aria-label={title}>
      <span className="empty-state__icon" aria-hidden="true">
        <Icon name={icon} className="empty-state__icon-svg" />
      </span>
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__description">{description}</p>
    </section>
  );
}

function TransactionTableSkeleton() {
  return (
    <section className="transactions-skeleton" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <section key={index} className="transactions-skeleton__row">
          <span className="transactions-skeleton__cell transactions-skeleton__cell--checkbox" />
          <span className="transactions-skeleton__cell transactions-skeleton__cell--transaction" />
          <span className="transactions-skeleton__cell transactions-skeleton__cell--item" />
          <span className="transactions-skeleton__cell transactions-skeleton__cell--person" />
          <span className="transactions-skeleton__cell transactions-skeleton__cell--person" />
          <span className="transactions-skeleton__cell transactions-skeleton__cell--amount" />
          <span className="transactions-skeleton__cell transactions-skeleton__cell--status" />
          <span className="transactions-skeleton__cell transactions-skeleton__cell--actions" />
        </section>
      ))}
    </section>
  );
}

function StatCard({ icon, value, label, subLabel }) {
  return (
    <article className="stat-card">
      <header className="stat-card__top">
        <span className="stat-card__icon" aria-hidden="true">
          <Icon name={icon} className="stat-card__icon-svg" />
        </span>
      </header>
      <p className="stat-card__value">{value}</p>
      <footer className="stat-card__footer">
        <p className="stat-card__label">{label}</p>
        {subLabel ? <p className="stat-card__sublabel">{subLabel}</p> : null}
      </footer>
    </article>
  );
}

function BookingCard({ booking, transaction }) {
  const isDropoff = booking.type === "dropoff";
  const operationalHint = isDropoff
    ? "Auto-confirmed booking. Use Manage Bookings once the seller physically drops the item off."
    : "Auto-confirmed booking. Use Manage Bookings once the buyer physically collects the item.";

  return (
    <article className="booking-card">
      <header className="booking-card__header">
        <section className="booking-card__header-left">
          <Avatar name={booking.personName} />
          <section className="booking-card__person-info">
            <p className="booking-card__person-name">{booking.personName}</p>
            <p className="booking-card__person-meta">
              {booking.studentId} · {booking.role === "seller" ? "Seller" : "Buyer"}
            </p>
          </section>
        </section>
        <section className="booking-card__header-right">
          <span className={`booking-type-tag booking-type-tag--${booking.type}`}>
            {isDropoff ? "Drop-off" : "Collection"}
          </span>
          <BookingStatusBadge status={booking.status} />
        </section>
      </header>

      <section className="booking-card__body">
        <ul className="booking-card__details" role="list">
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Item</span>
            <span className="booking-card__detail-value">{booking.itemName}</span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Facility</span>
            <span className="booking-card__detail-value">{booking.location || "-"}</span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Scheduled</span>
            <span className="booking-card__detail-value">
              {formatDate(booking.scheduledDate)} at {booking.scheduledTime}
            </span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Transaction</span>
            <span className="booking-card__detail-value booking-card__txn-id">{booking.transactionId}</span>
          </li>
          {transaction ? (
            <li className="booking-card__detail">
              <span className="booking-card__detail-label">Txn Status</span>
              <StatusBadge status={transaction.status} />
            </li>
          ) : null}
          <li className="booking-card__detail booking-card__detail--full">
            <span className="booking-card__detail-label">Next step</span>
            <span className="booking-card__detail-value managed-card__hint">{operationalHint}</span>
          </li>
        </ul>
      </section>
    </article>
  );
}

function ManagedTransactionCard({ transaction, bookings, onAction, saving }) {
  const { status } = transaction;
  const dropoffBooking = bookings.find((booking) => booking.id === transaction.dropoffId);
  const collectionBooking = bookings.find((booking) => booking.id === transaction.collectionId);
  const isItemTrade = transaction.transaction_type === "item_trade" || Boolean(transaction.offered_listing_id);

  const getAction = () => {
    switch (status) {
      case "awaiting_payment":
        return null;
      case "awaiting_dropoff":
      return {
        label: "Mark Item Received",
        icon: "package",
        cls: "btn-action--receipt",
        next: "item_received",
        hint: "Confirm the seller has handed the item over.",
      };
      case "awaiting_meetup":
        return null;

      case "item_received":
        return null;
      case "awaiting_collection":
        return {
          label: "Confirm Collection",
          icon: "handoff",
          cls: "btn-action--release",
          next: "item_released",
          hint: isItemTrade ? "Confirm the final swap handover is complete." : "Confirm the buyer has collected the item.",
        };
      case "item_released":
        return {
          label: "Mark Transaction Complete",
          icon: "check-circle",
          cls: "btn-action--receipt",
          next: "completed",
          hint: "Close the transaction and archive it.",
        };
      default:
        return null;
    }
  };

  const action = getAction();

  return (
    <article className="booking-card managed-card">
      <header className="booking-card__header">
        <section className="booking-card__header-left">
          <section className="booking-card__person-info">
            <p className="booking-card__person-name">{transaction.item}</p>
            {isItemTrade ? (
              <p className="booking-card__person-meta">
                {transaction.requested_item || "Listed item"} for {transaction.offered_item || "offered item"}
              </p>
            ) : null}
            <p className="booking-card__person-meta booking-card__txn-id">{transaction.id}</p>
          </section>
        </section>
        <section className="booking-card__header-right">
          <StatusBadge status={status} />
        </section>
      </header>

      <section className="booking-card__body">
        <ul className="booking-card__details" role="list">
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Seller</span>
            <span className="booking-card__detail-value">{transaction.seller.name}</span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Buyer</span>
            <span className="booking-card__detail-value">{transaction.buyer.name}</span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">{isItemTrade ? "Trade" : "Value"}</span>
            <span className="booking-card__detail-value">
              {isItemTrade ? "Item for item" : `R ${Number(transaction.price || 0).toLocaleString("en-ZA")}`}
            </span>
          </li>
          {!isItemTrade ? (
            <li className="booking-card__detail">
              <span className="booking-card__detail-label">Payment</span>
              <span className="booking-card__detail-value">
                {transaction.payment_status === "paid" ? "Paid" : "PayFast sandbox pending"}
              </span>
            </li>
          ) : null}
          {dropoffBooking ? (
            <li className="booking-card__detail">
              <span className="booking-card__detail-label">Drop-off</span>
              <span className="booking-card__detail-value booking-card__detail-stack">
                <span>{formatDate(dropoffBooking.scheduledDate)} {dropoffBooking.scheduledTime}</span>
                <span>{dropoffBooking.location || "Facility not recorded"}</span>
                <BookingStatusBadge status={dropoffBooking.status} />
              </span>
            </li>
          ) : null}
          {collectionBooking ? (
            <li className="booking-card__detail">
              <span className="booking-card__detail-label">Collection</span>
              <span className="booking-card__detail-value booking-card__detail-stack">
                <span>{formatDate(collectionBooking.scheduledDate)} {collectionBooking.scheduledTime}</span>
                <span>{collectionBooking.location || dropoffBooking?.location || "Seller drop-off facility"}</span>
                <BookingStatusBadge status={collectionBooking.status} />
              </span>
            </li>
          ) : null}
          {status === "awaiting_payment" ? (
            <li className="booking-card__detail booking-card__detail--full">
              <span className="booking-card__detail-label">Next step</span>
              <span className="booking-card__detail-value managed-card__hint">
                Waiting for the seller to book a drop-off slot. Buyer payment opens after staff receives the item.
              </span>
            </li>
          ) : null}
          {status === "item_received" ? (
            <li className="booking-card__detail booking-card__detail--full">
              <span className="booking-card__detail-label">Next step</span>
              <span className="booking-card__detail-value managed-card__hint">
                {isItemTrade ? "Waiting for the other student to book the swap handover slot." : "Item checked in. Waiting for the buyer to pay before collection booking opens."}
              </span>
            </li>
          ) : null}
          {action?.hint ? (
            <li className="booking-card__detail booking-card__detail--full">
              <span className="booking-card__detail-label">Action</span>
              <span className="booking-card__detail-value managed-card__hint">{action.hint}</span>
            </li>
          ) : null}
        </ul>
      </section>

      {action ? (
        <footer className="booking-card__footer">
          <menu className="booking-card__actions" role="list">
            <li>
              <button
                className={`btn-action ${action.cls}`}
                onClick={() => onAction(transaction, action.next)}
                disabled={saving}
              >
                <Icon name={action.icon} className="btn-action__icon" />
                {action.label}
              </button>
            </li>
          </menu>
        </footer>
      ) : null}
    </article>
  );
}

function ConfirmDialog({ dialog, onConfirm, onCancel, saving }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  if (!dialog) return null;

  const titles = {
    accept_booking: "Approve Booking",
    decline_booking: "Decline Booking",
    managed_action: `Confirm: ${STATUS_META[dialog.nextStatus]?.label || dialog.nextStatus}`,
  };

  const subtitles = {
    accept_booking: "Approve this facility booking and keep the transaction aligned with the schedule.",
    decline_booking: "Decline this booking and notify the student to choose another slot.",
    managed_action: `Update the transaction to "${STATUS_META[dialog.nextStatus]?.label || dialog.nextStatus}".`,
  };

  const iconName =
    dialog.actionType === "accept_booking"
      ? "check-circle"
      : dialog.actionType === "decline_booking"
        ? "x-circle"
        : "settings";

  return (
    <dialog ref={ref} className="confirm-dialog" onClose={onCancel}>
      <header className="confirm-dialog__header">
        <span className="confirm-dialog__icon" aria-hidden="true">
          <Icon name={iconName} className="confirm-dialog__icon-svg" />
        </span>
        <h2 className="confirm-dialog__title">{titles[dialog.actionType]}</h2>
        <p className="confirm-dialog__subtitle">{subtitles[dialog.actionType]}</p>
      </header>

      <section className="confirm-dialog__body">
        <ul className="confirm-dialog__info" role="list">
          {dialog.booking ? (
            <>
              <li className="confirm-dialog__info-row">
                <span className="confirm-dialog__info-label">Item</span>
                <span className="confirm-dialog__info-value">{dialog.booking.itemName}</span>
              </li>
              <li className="confirm-dialog__info-row">
                <span className="confirm-dialog__info-label">Person</span>
                <span className="confirm-dialog__info-value">{dialog.booking.personName}</span>
              </li>
              <li className="confirm-dialog__info-row">
                <span className="confirm-dialog__info-label">Facility</span>
                <span className="confirm-dialog__info-value">{dialog.booking.location || "-"}</span>
              </li>
            </>
          ) : null}
          {dialog.transaction ? (
            <li className="confirm-dialog__info-row">
              <span className="confirm-dialog__info-label">Transaction</span>
              <span className="confirm-dialog__info-value">{dialog.transaction.id}</span>
            </li>
          ) : null}
        </ul>
      </section>

      <footer className="confirm-dialog__footer">
        <button className="btn-export" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn-primary" onClick={onConfirm} disabled={saving}>
          {saving ? "Saving..." : "Confirm"}
        </button>
      </footer>
    </dialog>
  );
}

function OverviewSection({ transactions, bookings }) {
  const pendingRequests = bookings.filter((booking) => booking.status === "scheduled").length;
  const managed = transactions.filter((transaction) => MANAGED_STATUSES.includes(transaction.status)).length;
  const awaitingPayment = transactions.filter((transaction) => transaction.status === "awaiting_payment").length;
  const awaitingDropoff = transactions.filter((transaction) => transaction.status === "awaiting_dropoff").length;
  const awaitingCollection = transactions.filter((transaction) => transaction.status === "awaiting_collection").length;
  const completedAll = transactions.filter((transaction) => transaction.status === "completed").length;
  const totalValue = transactions.reduce((sum, transaction) => sum + Number(transaction.price || 0), 0);
  const itemReceivedCount = transactions.filter((transaction) => transaction.status === "item_received").length;
  const itemReleasedCount = transactions.filter((transaction) => transaction.status === "item_released").length;

  const latestTransactions = transactions.slice(0, 5);

  return (
    <section className="view-section">
      <article className="panel">
        <header className="panel__header">
          <section>
            <p className="panel__eyebrow">Operations Snapshot</p>
            <h3 className="panel__title">Facility Activity</h3>
            <p className="panel__subtitle">Live trade handover progress across bookings, collections, and completed trades.</p>
          </section>
        </header>

        <section className="operations-snapshot" aria-label="Operations snapshot metrics">
          <section className="operations-snapshot__primary" role="list">
            <article role="listitem">
              <StatCard icon="settings" value={managed} label="Active in Manage" subLabel="Transactions currently in motion across the facility workflow" />
            </article>
            <article role="listitem">
              <StatCard icon="table" value={pendingRequests} label="Scheduled Bookings" subLabel="Confirmed staff appointments that still need physical handling" />
            </article>
            <article role="listitem">
              <StatCard icon="receipt" value={awaitingPayment} label="Awaiting Payment" subLabel="Buyer payment happens after staff item receipt" />
            </article>
            <article role="listitem">
              <StatCard icon="receipt" value={`R ${totalValue.toLocaleString("en-ZA")}`} label="Processed Value" subLabel="Combined trade value represented in the live ledger" />
            </article>
          </section>

          <section className="operations-snapshot__secondary" role="list">
            <article role="listitem">
              <StatCard icon="arrow-down" value={awaitingDropoff} label="Awaiting Drop-off" subLabel="Seller arrival still pending" />
            </article>
            <article role="listitem">
              <StatCard icon="package" value={itemReceivedCount} label="Item Received" subLabel="Items checked in and waiting for buyer action" />
            </article>
            <article role="listitem">
              <StatCard icon="arrow-up" value={awaitingCollection} label="Ready for Collection" subLabel="Buyers can arrive for handover" />
            </article>
            <article role="listitem">
              <StatCard icon="handoff" value={itemReleasedCount} label="Item Released" subLabel="Collected and nearing closure" />
            </article>
            <article role="listitem">
              <StatCard icon="check-circle" value={completedAll} label="Completed Transactions" subLabel="Closed handovers and archived trades" />
            </article>
          </section>
        </section>
      </article>

      <section className="overview-grid">
        <article className="panel">
          <header className="panel__header">
            <section>
              <p className="panel__eyebrow">Live Queue</p>
              <h3 className="panel__title">Transaction Flow</h3>
              <p className="panel__subtitle">Status distribution across the current handover pipeline.</p>
            </section>
          </header>

          <section className="flow-list" role="list">
            {[
              { key: "awaiting_payment", count: awaitingPayment },
              { key: "awaiting_dropoff", count: awaitingDropoff },
              { key: "item_received", count: transactions.filter((transaction) => transaction.status === "item_received").length },
              { key: "awaiting_collection", count: awaitingCollection },
              { key: "item_released", count: transactions.filter((transaction) => transaction.status === "item_released").length },
              { key: "completed", count: completedAll },
            ].map((item) => (
              <article className="flow-item" key={item.key} role="listitem">
                <article className="flow-item__meta">
                  <StatusBadge status={item.key} />
                  <span className="flow-item__count">{item.count}</span>
                </article>
                <article className="flow-item__bar">
                  <span
                    style={{
                      width: `${transactions.length ? Math.max((item.count / transactions.length) * 100, item.count ? 6 : 0) : 0}%`,
                    }}
                  />
                </article>
              </article>
            ))}
          </section>
        </article>

        <article className="panel">
          <header className="panel__header">
            <section>
              <p className="panel__eyebrow">Recent Activity</p>
              <h3 className="panel__title">Latest Transactions</h3>
              <p className="panel__subtitle">Most recently created trade records in the facility ledger.</p>
            </section>
          </header>

          {latestTransactions.length === 0 ? (
            <EmptyState icon="activity" title="No activity yet" description="New trade transactions will appear here as they are created." />
          ) : (
            <ul className="activity-feed" role="list">
              {latestTransactions.map((transaction) => (
                <li key={transaction.id} className="activity-item">
                  <span className={`activity-item__dot activity-item__dot--${transaction.status}`} />
                  <article className="activity-item__content">
                    <p className="activity-item__text">
                      <strong>{transaction.item}</strong> for <em>R {Number(transaction.price || 0).toLocaleString("en-ZA")}</em>
                    </p>
                    <p className="activity-item__meta">
                      {transaction.seller.name} to {transaction.buyer.name} · {formatDate(transaction.createdAt?.slice(0, 10) || "")}
                    </p>
                  </article>
                  <StatusBadge status={transaction.status} />
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </section>
  );
}

function BookingsSection({ type, bookings, transactions }) {
  const [search, setSearch] = useState("");
  const label = type === "dropoff" ? "Drop-off" : "Collection";

  const transactionById = useMemo(
    () => Object.fromEntries(transactions.map((transaction) => [transaction.id, transaction])),
    [transactions],
  );

  const filtered = bookings.filter((booking) => {
    if (booking.type !== type) return false;
    const transaction = transactionById[booking.transactionId];
    if (!transaction) return false;
    if (type === "dropoff" && !["awaiting_dropoff", "item_received"].includes(transaction.status)) return false;
    if (type === "collection" && !["awaiting_collection", "item_released", "completed"].includes(transaction.status)) return false;
    if (!["scheduled", "completed"].includes(booking.status)) return false;
    if (!search.trim()) return true;
    const haystack = [booking.personName, booking.itemName, booking.studentId, booking.transactionId, booking.location]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <section className="view-section" aria-labelledby={`${type}-heading`}>
      <h2 id={`${type}-heading`} className="sr-only">{label} Bookings</h2>

      <article className="panel">
        <header className="panel__header">
          <section>
            <p className="panel__eyebrow">{label} Queue</p>
            <h3 className="panel__title">{label} Bookings</h3>
            <p className="panel__subtitle">
              {type === "dropoff"
                ? "Drop-off slots confirm automatically. Use Manage Bookings once the seller hands the item over."
                : "Collection times confirm automatically at the seller's drop-off facility. Use Manage Bookings once the buyer completes the pickup."}
            </p>
          </section>
          <p className="panel__count">{filtered.length} visible</p>
        </header>

        <section className="bookings-controls">
          <label htmlFor={`${type}-search`} className="dashboard-search">
            <Icon name="search" className="dashboard-search__icon" />
            <span className="sr-only">Search bookings</span>
            <input
              id={`${type}-search`}
              type="search"
              className="bookings-search"
              placeholder="Search by name, item, or transaction ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </section>

        {filtered.length === 0 ? (
          <EmptyState
            icon="table"
            title={`No ${label.toLowerCase()} bookings`}
            description={`Auto-confirmed ${label.toLowerCase()} bookings will appear here once students schedule them.`}
          />
        ) : (
          <ul className="booking-list" role="list">
            {filtered.map((booking) => {
              const transaction = transactionById[booking.transactionId];
              return (
                <li key={booking.id}>
                  <BookingCard booking={booking} transaction={transaction} />
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </section>
  );
}

function ManageBookingsSection({ transactions, bookings, onAction, savingIds }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const managed = useMemo(
    () => transactions.filter((transaction) => MANAGED_STATUSES.includes(transaction.status)),
    [transactions],
  );

  const filtered = useMemo(
    () =>
      managed.filter((transaction) => {
        if (statusFilter !== "all" && transaction.status !== statusFilter) return false;
        if (!search.trim()) return true;
        const haystack = [transaction.id, transaction.item, transaction.seller?.name, transaction.buyer?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search.toLowerCase());
      }),
    [managed, search, statusFilter],
  );

  const statusFilterOptions = [
    { value: "all", label: "All Active" },
    { value: "awaiting_payment", label: "Awaiting Payment" },
    { value: "awaiting_dropoff", label: "Awaiting Drop-off" },
    { value: "awaiting_meetup", label: "Awaiting Swap Meetup" },
    { value: "item_received", label: "Item Received" },
    { value: "awaiting_collection", label: "Awaiting Collection" },
    { value: "item_released", label: "Item Released" },
  ];

  return (
    <section className="view-section" aria-labelledby="manage-heading">
      <h2 id="manage-heading" className="sr-only">Manage Bookings</h2>

      <article className="panel">
        <header className="panel__header">
          <section>
            <p className="panel__eyebrow">Workflow Control</p>
            <h3 className="panel__title">Manage Bookings</h3>
            <p className="panel__subtitle">
              Move accepted transactions through the physical handover lifecycle, from intake to final completion.
            </p>
          </section>
          <p className="panel__count">{filtered.length} of {managed.length} active</p>
        </header>

        <section className="bookings-controls bookings-controls--row">
          <label htmlFor="manage-search" className="dashboard-search">
            <Icon name="search" className="dashboard-search__icon" />
            <span className="sr-only">Search transactions</span>
            <input
              id="manage-search"
              type="search"
              className="bookings-search"
              placeholder="Search by item, buyer, seller, or transaction ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="status-select-wrap" htmlFor="manage-filter">
            <span className="sr-only">Filter by status</span>
            <select
              id="manage-filter"
              className="status-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </section>

        {filtered.length === 0 ? (
          <EmptyState
            icon="settings"
            title="No active transactions"
            description="Accepted offers appear here once payment starts. Students book facility slots from My Bookings."
          />
        ) : (
          <ul className="booking-list booking-list--dense" role="list">
            {filtered.map((transaction) => (
              <li key={transaction.id}>
                <ManagedTransactionCard
                  transaction={transaction}
                  bookings={bookings}
                  onAction={onAction}
                  saving={Boolean(savingIds[transaction.id])}
                />
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}

function TransactionsSection({
  transactions,
  bookings,
  loading = false,
  onTransactionStatusChange,
  statusSavingIds,
  onOpenReceiptModal,
  onGenerateReceipt,
}) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const [statusFilter, setStatusFilter] = useState("all");
  const [itemTypeFilter, setItemTypeFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [buyerFilter, setBuyerFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState("");
  const [expandedRowId, setExpandedRowId] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const actionMenuRefs = useRef({});
  const statusSelectRefs = useRef({});
  const pageSize = 10;

  const transactionStatusOptions = [
    "awaiting_payment",
    "awaiting_dropoff",
    "awaiting_meetup",
    "item_received",
    "awaiting_collection",
    "item_released",
    "completed",
    "cancelled",
  ];

  const sellerOptions = useMemo(
    () => Array.from(new Set(transactions.map((transaction) => transaction.seller.name).filter(Boolean))).sort(),
    [transactions],
  );

  const buyerOptions = useMemo(
    () => Array.from(new Set(transactions.map((transaction) => transaction.buyer.name).filter(Boolean))).sort(),
    [transactions],
  );

  const filtered = useMemo(() => {
    const now = new Date();
    const searchValue = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const itemType = getItemTypeLabel(transaction);
      const createdAt = transaction.createdAt ? new Date(transaction.createdAt) : null;
      const haystack = [
        transaction.id,
        transaction.item,
        transaction.itemDescription,
        transaction.seller.name,
        transaction.seller.studentId,
        transaction.buyer.name,
        transaction.buyer.studentId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (searchValue && !haystack.includes(searchValue)) return false;
      if (statusFilter !== "all" && transaction.status !== statusFilter) return false;
      if (itemTypeFilter !== "all" && itemType !== itemTypeFilter) return false;
      if (sellerFilter !== "all" && transaction.seller.name !== sellerFilter) return false;
      if (buyerFilter !== "all" && transaction.buyer.name !== buyerFilter) return false;

      if (dateRangeFilter !== "all" && createdAt) {
        const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
        if (dateRangeFilter === "7d" && diffDays > 7) return false;
        if (dateRangeFilter === "30d" && diffDays > 30) return false;
        if (dateRangeFilter === "90d" && diffDays > 90) return false;
      }

      return true;
    });
  }, [buyerFilter, dateRangeFilter, itemTypeFilter, search, sellerFilter, statusFilter, transactions]);

  const sortedTransactions = useMemo(() => {
    const valueFor = (transaction, key) => {
      switch (key) {
        case "id":
          return transaction.id || "";
        case "item":
          return transaction.item || "";
        case "seller":
          return transaction.seller.name || "";
        case "buyer":
          return transaction.buyer.name || "";
        case "amount":
          return Number(transaction.totalAmount || 0);
        case "status":
          return STATUS_META[transaction.status]?.label || transaction.status || "";
        case "createdAt":
        default:
          return new Date(transaction.createdAt || 0).getTime();
      }
    };

    return [...filtered].sort((a, b) => {
      const aValue = valueFor(a, sortConfig.key);
      const bValue = valueFor(b, sortConfig.key);
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * direction;
      }

      return String(aValue).localeCompare(String(bValue), "en", { sensitivity: "base" }) * direction;
    });
  }, [filtered, sortConfig]);

  const pageCount = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const validSelectedIds = useMemo(
    () => selectedIds.filter((id) => sortedTransactions.some((transaction) => transaction.id === id)),
    [selectedIds, sortedTransactions],
  );
  const paginatedTransactions = useMemo(
    () => sortedTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, sortedTransactions],
  );
  const pageIds = paginatedTransactions.map((transaction) => transaction.id);
  const allVisibleSelected = pageIds.length > 0 && pageIds.every((id) => validSelectedIds.includes(id));
  const activeFilterCount = [statusFilter, itemTypeFilter, dateRangeFilter, sellerFilter, buyerFilter].filter(
    (value) => value !== "all",
  ).length;

  useEffect(() => {
    if (!openMenuId) return undefined;

    const handleOutsideClick = (event) => {
      const activeMenu = actionMenuRefs.current[openMenuId];
      if (activeMenu && !activeMenu.contains(event.target)) {
        setOpenMenuId("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openMenuId]);

  useEffect(() => {
    if (!copiedId) return undefined;
    const timer = window.setTimeout(() => setCopiedId(""), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  const bookingMap = useMemo(
    () => Object.fromEntries(bookings.map((booking) => [booking.id, booking])),
    [bookings],
  );

  const handleSort = useCallback((key) => {
    setSortConfig((current) => (
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "createdAt" ? "desc" : "asc" }
    ));
    setPage(1);
  }, []);

  const handleCopyId = useCallback(async (transactionId) => {
    try {
      await navigator.clipboard.writeText(transactionId);
      setCopiedId(transactionId);
    } catch {
      setCopiedId("");
    }
  }, []);

  const clearFilters = useCallback(() => {
    setStatusFilter("all");
    setItemTypeFilter("all");
    setDateRangeFilter("all");
    setSellerFilter("all");
    setBuyerFilter("all");
    setPage(1);
  }, []);

  const toggleSelection = useCallback((transactionId) => {
    setSelectedIds((prev) => (
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId]
    ));
  }, []);

  const togglePageSelection = useCallback(() => {
    setSelectedIds((prev) => (
      allVisibleSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...prev, ...pageIds]))
    ));
  }, [allVisibleSelected, pageIds]);

  const openStatusEditor = useCallback((transactionId) => {
    setOpenMenuId("");
    statusSelectRefs.current[transactionId]?.focus();
  }, []);

  const toggleExpandedRow = useCallback((transactionId) => {
    setExpandedRowId((current) => (current === transactionId ? "" : transactionId));
    setOpenMenuId("");
  }, []);

  return (
    <section className="view-section" aria-labelledby="transactions-heading">
      <h2 id="transactions-heading" className="sr-only">Transaction Ledger</h2>

      <article className="panel">
        <header className="panel__header">
          <section>
            <p className="panel__eyebrow">Full Ledger</p>
            <h3 className="panel__title">Transaction Ledger</h3>
            <p className="panel__subtitle">Complete view of accepted offers across every handover stage.</p>
          </section>
          <p className="panel__count">{filtered.length} of {transactions.length} transactions</p>
        </header>

        <section className="bookings-controls transactions-toolbar-wrap">
          <section className="transactions-toolbar">
            <label htmlFor="txn-search" className="dashboard-search transactions-toolbar__search">
              <Icon name="search" className="dashboard-search__icon" />
              <span className="sr-only">Search transactions</span>
              <input
                id="txn-search"
                type="search"
                className="bookings-search"
                placeholder="Search by transaction ID, item, buyer, or seller..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <section className="transactions-toolbar__summary" aria-live="polite">
              <span className="transactions-toolbar__count">
                {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
              </span>
              <span className="transactions-toolbar__selection">
                {validSelectedIds.length} selected
              </span>
            </section>
            <button type="button" className="btn-primary" onClick={onOpenReceiptModal}>
              <Icon name="receipt" className="btn-action__icon" />
              Generate Receipt
            </button>
          </section>

          <section className="transactions-filters" aria-label="Transaction filters">
            <label className="filter-chip">
              <Icon name="calendar" className="filter-chip__icon" />
              <span>Date Range</span>
              <select
                value={dateRangeFilter}
                onChange={(event) => {
                  setDateRangeFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Dates</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </label>
            <label className="filter-chip">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Statuses</option>
                {transactionStatusOptions.map((status) => (
                  <option key={status} value={status}>{STATUS_META[status]?.label || status}</option>
                ))}
              </select>
            </label>
            <label className="filter-chip">
              <span>Item Type</span>
              <select
                value={itemTypeFilter}
                onChange={(event) => {
                  setItemTypeFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Types</option>
                <option value="Sale">Sale</option>
                <option value="Item Trade">Item Trade</option>
              </select>
            </label>
            <label className="filter-chip">
              <span>Seller</span>
              <select
                value={sellerFilter}
                onChange={(event) => {
                  setSellerFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Sellers</option>
                {sellerOptions.map((seller) => <option key={seller} value={seller}>{seller}</option>)}
              </select>
            </label>
            <label className="filter-chip">
              <span>Buyer</span>
              <select
                value={buyerFilter}
                onChange={(event) => {
                  setBuyerFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Buyers</option>
                {buyerOptions.map((buyer) => <option key={buyer} value={buyer}>{buyer}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="transactions-clear-filters"
              onClick={clearFilters}
              disabled={activeFilterCount === 0}
            >
              Clear Filters
            </button>
          </section>
        </section>

        {loading ? (
          <TransactionTableSkeleton />
        ) : filtered.length === 0 ? (
          <section className="transactions-empty-state">
            <EmptyState icon="search" title="No transactions match these filters" description="Try broadening the date range, clearing a chip, or searching with a different seller, buyer, or item name." />
          </section>
        ) : (
          <>
          <figure className="table-figure transactions-table-wrap" role="group" aria-label="Transactions table">
            <table className="report-table transactions-table">
              <thead>
                <tr>
                  <th scope="col" className="transactions-table__checkbox-col">
                    <input type="checkbox" aria-label={allVisibleSelected ? "Deselect current page rows" : "Select current page rows"} checked={allVisibleSelected} onChange={togglePageSelection} />
                  </th>
                  <th scope="col">
                    <button type="button" className="transactions-table__header-btn" onClick={() => handleSort("createdAt")}>
                      Transaction <span className="transactions-table__sort">{sortConfig.key === "createdAt" ? (sortConfig.direction === "asc" ? "^" : "v") : "-"}</span>
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="transactions-table__header-btn" onClick={() => handleSort("item")}>
                      Item <span className="transactions-table__sort">{sortConfig.key === "item" ? (sortConfig.direction === "asc" ? "^" : "v") : "-"}</span>
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="transactions-table__header-btn" onClick={() => handleSort("seller")}>
                      Seller <span className="transactions-table__sort">{sortConfig.key === "seller" ? (sortConfig.direction === "asc" ? "^" : "v") : "-"}</span>
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="transactions-table__header-btn" onClick={() => handleSort("buyer")}>
                      Buyer <span className="transactions-table__sort">{sortConfig.key === "buyer" ? (sortConfig.direction === "asc" ? "^" : "v") : "-"}</span>
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="transactions-table__header-btn" onClick={() => handleSort("amount")}>
                      Value <span className="transactions-table__sort">{sortConfig.key === "amount" ? (sortConfig.direction === "asc" ? "^" : "v") : "-"}</span>
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="transactions-table__header-btn" onClick={() => handleSort("status")}>
                      Status <span className="transactions-table__sort">{sortConfig.key === "status" ? (sortConfig.direction === "asc" ? "^" : "v") : "-"}</span>
                    </button>
                  </th>
                  <th scope="col">Drop-off</th>
                  <th scope="col">Collection</th>
                  <th scope="col" className="transactions-table__actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((transaction) => {
                  const dropoff = bookingMap[transaction.dropoffId] || bookingMap[transaction.dropoff_id];
                  const collection = bookingMap[transaction.collectionId] || bookingMap[transaction.collection_id];
                  const isItemTrade = transaction.transaction_type === "item_trade" || Boolean(transaction.offered_listing_id);
                  const selected = validSelectedIds.includes(transaction.id);
                  const expanded = expandedRowId === transaction.id;

                  return (
                    <Fragment key={transaction.id}>
                    <tr className={`transactions-table__row${selected ? " transactions-table__row--selected" : ""}`}>
                      <td>
                        <input type="checkbox" aria-label={`Select transaction ${transaction.id}`} checked={selected} onChange={() => toggleSelection(transaction.id)} />
                      </td>
                      <td>
                        <section className="txn-transaction-cell">
                          <section className="txn-id-row">
                            <span className="txn-id-chip">{transaction.id}</span>
                            <button type="button" className="txn-copy-btn" onClick={() => handleCopyId(transaction.id)} aria-label={`Copy transaction ID ${transaction.id}`}>
                              <Icon name="copy" className="txn-copy-btn__icon" />
                            </button>
                          </section>
                          <p className="txn-date txn-date--calendar">
                            <Icon name="calendar" className="txn-date__icon" />
                            <span>{formatDateTimeLong(transaction.createdAt)}</span>
                          </p>
                          {copiedId === transaction.id && <p className="txn-date">Copied</p>}
                        </section>
                      </td>
                      <td>
                        <section className="txn-item-cell" title={transaction.item}>
                          {transaction.itemImageUrl ? (
                            <img src={transaction.itemImageUrl} alt="" className="txn-item-thumb" />
                          ) : (
                            <span className="txn-item-thumb txn-item-thumb--placeholder" aria-hidden="true">
                              {transaction.item?.slice(0, 1)?.toUpperCase() || "I"}
                            </span>
                          )}
                          <section className="txn-item-copy">
                            <p className="txn-item">{transaction.item}</p>
                            <p className="txn-item__meta">
                              {isItemTrade
                                ? `${transaction.requested_item || "Listed item"} for ${transaction.offered_item || "offered item"}`
                                : transaction.itemDescription || "Marketplace sale"}
                            </p>
                          </section>
                        </section>
                      </td>
                      <td>
                        <section className="txn-person">
                          <Avatar name={transaction.seller.name} size="sm" />
                          <section className="txn-person__copy">
                            <p className="txn-person__name">{transaction.seller.name}</p>
                            <p className="txn-person__id">{transaction.seller.studentId}</p>
                          </section>
                        </section>
                      </td>
                      <td>
                        <section className="txn-person">
                          <Avatar name={transaction.buyer.name} size="sm" />
                          <section className="txn-person__copy">
                            <p className="txn-person__name">{transaction.buyer.name}</p>
                            <p className="txn-person__id">{transaction.buyer.studentId}</p>
                          </section>
                        </section>
                      </td>
                      <td>
                        <p className="txn-price">{isItemTrade ? "Item trade" : `R ${Number(transaction.totalAmount || transaction.price || 0).toLocaleString("en-ZA")}`}</p>
                        <p className="txn-amount__meta">{getItemTypeLabel(transaction)}</p>
                      </td>
                      <td>
                        <span className="txn-status-stack">
                          <StatusBadge status={transaction.status} />
                          <label className="status-select-wrap">
                            <span className="sr-only">Update transaction status</span>
                            <select
                              className="status-select status-select--compact"
                              value={transaction.status}
                              ref={(node) => {
                                statusSelectRefs.current[transaction.id] = node;
                              }}
                              onChange={(event) => onTransactionStatusChange(transaction.id, event.target.value)}
                              disabled={Boolean(statusSavingIds[transaction.id])}
                            >
                              {transactionStatusOptions.map((status) => (
                                <option key={status} value={status}>{STATUS_META[status]?.label || status}</option>
                              ))}
                            </select>
                          </label>
                        </span>
                      </td>
                      <td>
                        {dropoff ? (
                          <section className="txn-booking-cell">
                            <p>{formatDate(dropoff.scheduledDate)}</p>
                            <p className="txn-booking-time">{dropoff.scheduledTime}</p>
                            <p className="txn-date">{dropoff.location || "-"}</p>
                            <BookingStatusBadge status={dropoff.status} />
                          </section>
                        ) : <span className="txn-na">-</span>}
                      </td>
                      <td>
                        {collection ? (
                          <section className="txn-booking-cell">
                            <p>{formatDate(collection.scheduledDate)}</p>
                            <p className="txn-booking-time">{collection.scheduledTime}</p>
                            <p className="txn-date">{collection.location || dropoff?.location || "-"}</p>
                            <BookingStatusBadge status={collection.status} />
                          </section>
                        ) : <span className="txn-na">-</span>}
                      </td>
                      <td>
                        <section
                          className="txn-actions"
                          ref={(node) => {
                            actionMenuRefs.current[transaction.id] = node;
                          }}
                        >
                          <button
                            type="button"
                            className="txn-actions__trigger"
                            aria-label={`Open actions for ${transaction.id}`}
                            onClick={() => setOpenMenuId((current) => current === transaction.id ? "" : transaction.id)}
                          >
                            <Icon name="more" className="txn-actions__trigger-icon" />
                          </button>
                          {openMenuId === transaction.id && (
                            <section className="txn-actions__menu">
                              <button type="button" onClick={() => toggleExpandedRow(transaction.id)}>
                                {expanded ? "Hide details" : "View details"}
                              </button>
                              <button type="button" onClick={() => openStatusEditor(transaction.id)}>
                                Change status
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId("");
                                  if (onGenerateReceipt) onGenerateReceipt(transaction);
                                  else onOpenReceiptModal();
                                }}
                              >
                                Generate receipt
                              </button>
                            </section>
                          )}
                        </section>
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${transaction.id}-details`} className="transactions-table__detail-row">
                        <td colSpan={10}>
                          <section className="transactions-detail-card">
                            <section className="transactions-detail-card__group">
                              <p className="transactions-detail-card__label">Description</p>
                              <p className="transactions-detail-card__value transactions-detail-card__value--muted">
                                {transaction.itemDescription || "No item description recorded."}
                              </p>
                            </section>
                            <section className="transactions-detail-card__group">
                              <p className="transactions-detail-card__label">Payment</p>
                              <p className="transactions-detail-card__value">
                                {transaction.paymentStatus || transaction.payment_status || "Not recorded"}
                              </p>
                            </section>
                            <section className="transactions-detail-card__group">
                              <p className="transactions-detail-card__label">Bookings</p>
                              <p className="transactions-detail-card__value transactions-detail-card__value--muted">
                                Drop-off: {dropoff?.id || "-"} | Collection: {collection?.id || "-"}
                              </p>
                            </section>
                          </section>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </figure>
          <section className="transactions-cards" aria-label="Transactions cards">
            {paginatedTransactions.map((transaction) => {
              const isItemTrade = transaction.transaction_type === "item_trade" || Boolean(transaction.offered_listing_id);
              return (
                <article key={`card-${transaction.id}`} className="transactions-card">
                  <section className="transactions-card__top">
                    <section>
                      <section className="txn-id-row">
                        <span className="txn-id-chip">{transaction.id}</span>
                        <button type="button" className="txn-copy-btn" onClick={() => handleCopyId(transaction.id)} aria-label={`Copy transaction ID ${transaction.id}`}>
                          <Icon name="copy" className="txn-copy-btn__icon" />
                        </button>
                      </section>
                      <p className="txn-date txn-date--calendar">
                        <Icon name="calendar" className="txn-date__icon" />
                        <span>{formatDateTimeLong(transaction.createdAt)}</span>
                      </p>
                    </section>
                    <StatusBadge status={transaction.status} />
                  </section>
                  <section className="txn-item-cell" title={transaction.item}>
                    <span className="txn-item-thumb txn-item-thumb--placeholder" aria-hidden="true">
                      {transaction.item?.slice(0, 1)?.toUpperCase() || "I"}
                    </span>
                    <section className="txn-item-copy">
                      <p className="txn-item">{transaction.item}</p>
                      <p className="txn-item__meta">{isItemTrade ? "Item trade" : "Marketplace sale"}</p>
                    </section>
                  </section>
                  <section className="transactions-card__meta">
                    <section className="txn-person">
                      <Avatar name={transaction.seller.name} size="sm" />
                      <section className="txn-person__copy">
                        <p className="txn-person__name">{transaction.seller.name}</p>
                        <p className="txn-person__id">{transaction.seller.studentId}</p>
                      </section>
                    </section>
                    <section className="txn-person">
                      <Avatar name={transaction.buyer.name} size="sm" />
                      <section className="txn-person__copy">
                        <p className="txn-person__name">{transaction.buyer.name}</p>
                        <p className="txn-person__id">{transaction.buyer.studentId}</p>
                      </section>
                    </section>
                  </section>
                  <section className="transactions-card__footer">
                    <section>
                      <p className="transactions-detail-card__label">Amount</p>
                      <p className="txn-price">
                        {isItemTrade ? "Item trade" : `R ${Number(transaction.totalAmount || transaction.price || 0).toLocaleString("en-ZA")}`}
                      </p>
                    </section>
                    <button type="button" className="btn-export" onClick={() => toggleExpandedRow(transaction.id)}>
                      {expandedRowId === transaction.id ? "Hide Details" : "View Details"}
                    </button>
                  </section>
                </article>
              );
            })}
          </section>
          <footer className="transactions-pagination">
            <p className="transactions-pagination__summary">
              Showing {paginatedTransactions.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, sortedTransactions.length)} of {sortedTransactions.length}
            </p>
            <section className="transactions-pagination__controls">
              <button type="button" className="btn-export" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>
                Previous
              </button>
              <span className="transactions-pagination__page">Page {currentPage} of {pageCount}</span>
              <button type="button" className="btn-export" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage === pageCount}>
                Next
              </button>
            </section>
          </footer>
          </>
        )}
      </article>
    </section>
  );
}

function UtilityRail({ transactions, bookings, activeView }) {
  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = bookings.filter((booking) => booking.scheduledDate === today).slice(0, 5);
  const nextActions = transactions
    .filter((transaction) => MANAGED_STATUSES.includes(transaction.status))
    .slice(0, 4);
  const completionRate = transactions.length
    ? Math.round((transactions.filter((transaction) => transaction.status === "completed").length / transactions.length) * 100)
    : 0;

  return (
    <aside className="utility-rail" aria-label="Operations side panel">
      <article className="panel utility-panel">
        <header className="panel__header">
          <section>
            <p className="panel__eyebrow">Today</p>
            <h3 className="panel__title">Operations Summary</h3>
            <p className="panel__subtitle">A quick view of what needs staff attention right now.</p>
          </section>
        </header>

        <section className="utility-metrics">
          <section className="utility-metric">
            <span className="utility-metric__label">Today's bookings</span>
            <strong className="utility-metric__value">{todayBookings.length}</strong>
          </section>
          <section className="utility-metric">
            <span className="utility-metric__label">In-progress trades</span>
            <strong className="utility-metric__value">{nextActions.length}</strong>
          </section>
          <section className="utility-metric">
            <span className="utility-metric__label">Completion rate</span>
            <strong className="utility-metric__value">{completionRate}%</strong>
          </section>
        </section>
      </article>

      <article className="panel utility-panel">
        <header className="panel__header">
          <section>
            <p className="panel__eyebrow">Schedule</p>
            <h3 className="panel__title">Today's Bookings</h3>
            <p className="panel__subtitle">Next facility appointments based on booking time.</p>
          </section>
        </header>

        {todayBookings.length === 0 ? (
          <EmptyState icon="clock" title="No bookings today" description="Scheduled slots for today will surface here automatically." />
        ) : (
          <ul className="schedule-list" role="list">
            {todayBookings.map((booking) => (
              <li key={booking.id} className="schedule-item">
                <article className="schedule-item__time">{booking.scheduledTime}</article>
                <article className="schedule-item__content">
                  <p className="schedule-item__title">{booking.personName}</p>
                  <p className="schedule-item__item">{booking.itemName}</p>
                </article>
                <BookingStatusBadge status={booking.status} />
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="panel utility-panel">
        <header className="panel__header">
          <section>
            <p className="panel__eyebrow">Attention Queue</p>
            <h3 className="panel__title">Next Actions</h3>
            <p className="panel__subtitle">Operational reminders based on active workflow states.</p>
          </section>
        </header>

        {nextActions.length === 0 ? (
          <EmptyState icon="check-circle" title="Nothing blocked" description="Active lifecycle tasks will appear here when staff action is needed." />
        ) : (
          <ul className="activity-feed" role="list">
            {nextActions.map((transaction) => (
              <li key={transaction.id} className="activity-item">
                <span className={`activity-item__dot activity-item__dot--${transaction.status}`} />
                <article className="activity-item__content">
                  <p className="activity-item__text">
                    <strong>{transaction.item}</strong>
                  </p>
                  <p className="activity-item__meta">
                    {STATUS_META[transaction.status]?.label || transaction.status}
                  </p>
                </article>
                <StatusBadge status={transaction.status} />
              </li>
            ))}
          </ul>
        )}

        <footer className="utility-panel__footer">
          <span className="utility-panel__context">
            Active view: {NAV_ITEMS.find((item) => item.key === activeView)?.label || "Overview"}
          </span>
        </footer>
      </article>
    </aside>
  );
}

function MeetupsSection({ transactions, bookings, onAction, savingIds }) {
  // Find the meetup booking for a transaction
  function getMeetupBooking(transaction) {
    if (!transaction.trade_meetup_id) return null;
    return bookings.find((b) => b.id === transaction.trade_meetup_id) || null;
  }

  return (
    <section className="view-section" aria-labelledby="meetups-heading">
      <h2 id="meetups-heading" className="sr-only">Trade Meetups</h2>
      <article className="panel">
        <header className="panel__header">
          <section>
            <p className="panel__eyebrow">Item-for-Item Swaps</p>
            <h3 className="panel__title">Trade Meetups</h3>
            <p className="panel__subtitle">
              Students choose and agree on one shared swap meetup slot in My Bookings. Staff only confirms the swap after both students arrive.
            </p>
          </section>
          <p className="panel__count">{transactions.length} awaiting meetup</p>
        </header>

        {transactions.length === 0 ? (
          <EmptyState icon="users" title="No pending meetups" description="Item-for-item trade meetups will appear here once a trade offer is accepted." />
        ) : (
          <ul className="booking-list booking-list--dense" role="list">
            {transactions.map((transaction) => {
              const meetupBooking = getMeetupBooking(transaction);
              const saving = Boolean(savingIds[transaction.id]);
              const proposerIsKnown = Boolean(transaction.trade_meetup_proposed_by);
              const proposerIsSeller = transaction.trade_meetup_proposed_by === transaction.seller_id;

              return (
                <li key={transaction.id}>
                  <article className="booking-card managed-card">
                    <header className="booking-card__header">
                      <section className="booking-card__header-left">
                        <section className="booking-card__person-info">
                          <p className="booking-card__person-name">{transaction.item}</p>
                          <p className="booking-card__person-meta">
                            {transaction.requested_item || "Listed item"} for {transaction.offered_item || "offered item"}
                          </p>
                          <p className="booking-card__person-meta booking-card__txn-id">{transaction.id}</p>
                        </section>
                      </section>
                      <section className="booking-card__header-right">
                        <StatusBadge status={transaction.status} />
                      </section>
                    </header>

                    <section className="booking-card__body">
                      <ul className="booking-card__details" role="list">
                        <li className="booking-card__detail">
                          <span className="booking-card__detail-label">Seller</span>
                          <span className="booking-card__detail-value">{transaction.seller.name}</span>
                        </li>
                        <li className="booking-card__detail">
                          <span className="booking-card__detail-label">Buyer</span>
                          <span className="booking-card__detail-value">{transaction.buyer.name}</span>
                        </li>

                        {meetupBooking ? (
                          <>
                            <li className="booking-card__detail">
                              <span className="booking-card__detail-label">Proposed Slot</span>
                              <span className="booking-card__detail-value">
                                {meetupBooking.location} · {formatDateTime(meetupBooking.scheduled_time).date} at {formatDateTime(meetupBooking.scheduled_time).time}
                              </span>
                            </li>
                            <li className="booking-card__detail">
                              <span className="booking-card__detail-label">Slot Status</span>
                              <BookingStatusBadge status={meetupBooking.status} />
                            </li>
                            <li className="booking-card__detail">
                              <span className="booking-card__detail-label">Proposed by</span>
                              <span className="booking-card__detail-value">
                                {proposerIsKnown
                                  ? (proposerIsSeller ? transaction.seller.name : transaction.buyer.name)
                                  : "Unknown"}
                              </span>
                            </li>
                            {meetupBooking.status === "scheduled" ? (
                              <li className="booking-card__detail booking-card__detail--full">
                                <span className="booking-card__detail-label">Note</span>
                                <span className="booking-card__detail-value managed-card__hint">
                                  Slot accepted by both parties. Use "Confirm Swap Complete" after the physical trade has happened.
                                </span>
                              </li>
                            ) : (
                              <li className="booking-card__detail booking-card__detail--full">
                                <span className="booking-card__detail-label">Next step</span>
                                <span className="booking-card__detail-value managed-card__hint">
                                  A slot has been proposed. The other student needs to accept it or request a different slot in My Bookings.
                                </span>
                              </li>
                            )}
                          </>
                        ) : (
                          <li className="booking-card__detail booking-card__detail--full">
                            <span className="booking-card__detail-label">Meetup slot</span>
                            <span className="booking-card__detail-value managed-card__hint">
                              No slot proposed yet. Students will propose one from My Bookings.
                            </span>
                          </li>
                        )}
                      </ul>
                    </section>

                    <footer className="booking-card__footer">
                      <menu className="booking-card__actions" role="list">
                        {meetupBooking?.status === "scheduled" && (
                          <>
                            <li>
                              <button
                                className="btn-action btn-action--release"
                                onClick={() => onAction(transaction, "completed")}
                                disabled={saving}
                              >
                                <Icon name="handoff" className="btn-action__icon" />
                                Confirm Swap Complete
                              </button>
                            </li>
                            <li>
                              <button
                                className="btn-action btn-action--danger"
                                onClick={() => onAction(transaction, "cancelled")}
                                disabled={saving}
                              >
                                <Icon name="x-circle" className="btn-action__icon" />
                                Mark Swap Not Completed
                              </button>
                            </li>
                          </>
                        )}
                      </menu>
                    </footer>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </section>
  );
}

export default function TradeFacilityDashboard({ onSignOut, staffProfile }) {
  const { notifySuccess, notifyError, notifyInfo } = useNotifications();
  const [activeView, setActiveView] = useState("overview");
  const [transactions, setTransactions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingIds, setSavingIds] = useState({});
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptGeneratingId, setReceiptGeneratingId] = useState("");
  const [isNavOpen, setIsNavOpen] = useState(false);

  const showToast = useCallback((msg) => {
    const lower = String(msg || "").toLowerCase();

    if (lower.includes("unable") || lower.includes("failed") || lower.includes("select a transaction")) {
      notifyError("Trade facility update", msg, { category: "facility", dedupeKey: `trade-error-${msg}` });
      return;
    }

    if (lower.includes("downloaded")) {
      notifyInfo("Receipt ready", msg, { category: "sync", dedupeKey: `trade-info-${msg}` });
      return;
    }

    notifySuccess("Trade facility update", msg, { category: "status", dedupeKey: `trade-success-${msg}` });
  }, [notifyError, notifyInfo, notifySuccess]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: txRows, error: txErr } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (txErr) throw txErr;

      const rows = txRows || [];
      const bookingIds = [...new Set(rows.flatMap((row) => [row.dropoff_id, row.collection_id, row.trade_meetup_id]).filter(Boolean))];
      const profileIds = [...new Set(rows.flatMap((row) => [row.seller_id, row.buyer_id]).filter(Boolean))];
      const sellerIds = [...new Set(rows.map((row) => row.seller_id).filter(Boolean))];

      const [
        { data: bookingRows, error: bookingError },
        { data: profileRows, error: profileError },
        { data: listingRows, error: listingError },
      ] = await Promise.all([
        bookingIds.length
          ? supabase.from("bookings").select("*").in("id", bookingIds)
          : Promise.resolve({ data: [], error: null }),
        profileIds.length
          ? supabase.from("profiles").select("id, name, display_name, email").in("id", profileIds)
          : Promise.resolve({ data: [], error: null }),
        sellerIds.length
          ? supabase
              .from("listings")
              .select("id, title, description, image_url, image_urls, user_id, sold_price, created_at")
              .order("created_at", { ascending: false })
              .in("user_id", sellerIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (bookingError) throw bookingError;
      if (profileError) throw profileError;
      if (listingError) throw listingError;

      const profilesById = Object.fromEntries((profileRows || []).map((profile) => [profile.id, profile]));
      const bookingsById = Object.fromEntries((bookingRows || []).map((booking) => [booking.id, booking]));
      const listingMatches = new Map();

      for (const listing of listingRows || []) {
        const key = buildListingMatchKey(listing.user_id, listing.title);
        if (!listingMatches.has(key)) {
          listingMatches.set(key, listing);
        }
      }

      const mappedTransactions = rows.map((transaction) => {
        const matchedListing = listingMatches.get(buildListingMatchKey(transaction.seller_id, transaction.item)) || null;
        const dropoffBooking = transaction.dropoff_id ? bookingsById[transaction.dropoff_id] || null : null;
        const collectionBooking = transaction.collection_id ? bookingsById[transaction.collection_id] || null : null;
        const isItemTrade = transaction.transaction_type === "item_trade" || Boolean(transaction.offered_listing_id);

        return {
          ...transaction,
          listing_id: transaction.listing_id || transaction.requested_listing_id || matchedListing?.id || null,
          dropoffId: transaction.dropoff_id,
          collectionId: transaction.collection_id,
          dropoffFacility: dropoffBooking?.location || "",
          collectionFacility: !isItemTrade && dropoffBooking?.location ? dropoffBooking.location : collectionBooking?.location || "",
          createdAt: transaction.created_at,
          matchedListing,
          itemDescription: matchedListing?.description || "",
          itemImageUrl: matchedListing?.image_url || matchedListing?.image_urls?.find(Boolean) || "",
          quantity: Number(transaction.quantity || 1),
          totalAmount: Number(transaction.total_amount ?? transaction.price ?? 0),
          paymentMethod: transaction.payment_method || "",
          seller: {
            name: profilesById[transaction.seller_id]?.display_name || profilesById[transaction.seller_id]?.name || transaction.seller_id,
            studentId: profilesById[transaction.seller_id]?.email || transaction.seller_id,
          },
          buyer: {
            name: profilesById[transaction.buyer_id]?.display_name || profilesById[transaction.buyer_id]?.name || transaction.buyer_id,
            studentId: profilesById[transaction.buyer_id]?.email || transaction.buyer_id,
          },
        };
      });

      setTransactions(mappedTransactions);
      setBookings(buildBookings(rows, profilesById, bookingsById));
    } catch (err) {
      setError(err.message || "Failed to load trade facility activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const channel = supabase
      .channel("trade-facility-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, loadDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, loadDashboard)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  useEffect(() => {
    setIsNavOpen(false);
  }, [activeView]);

  useEffect(() => {
    if (!isNavOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsNavOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNavOpen]);

  const handleAccept = useCallback((booking, transaction) => {
    setDialog({ actionType: "accept_booking", booking, transaction });
  }, []);

  const handleDecline = useCallback((booking, transaction) => {
    setDialog({ actionType: "decline_booking", booking, transaction });
  }, []);

  const handleManagedAction = useCallback((transaction, nextStatus) => {
    setDialog({ actionType: "managed_action", transaction, nextStatus });
  }, []);

  const handleTransactionStatusChange = useCallback(async (transactionId, nextStatus) => {
    setSavingIds((prev) => ({ ...prev, [transactionId]: true }));

    try {
      const updatePayload = { status: nextStatus };
      if (nextStatus === "completed") {
        updatePayload.buyer_rating_pending = true;
        updatePayload.seller_rating_pending = true;
      }

      const { error: err } = await supabase
        .from("transactions")
        .update(updatePayload)
        .eq("id", transactionId);

      if (err) throw err;

      showToast(`Transaction updated to "${STATUS_META[nextStatus]?.label || nextStatus}".`);
      await loadDashboard();
    } catch (err) {
      showToast(err.message || "Unable to update transaction status.");
    } finally {
      setSavingIds((prev) => {
        const next = { ...prev };
        delete next[transactionId];
        return next;
      });
    }
  }, [loadDashboard, showToast]);

  const handleDialogCancel = useCallback(() => {
    if (!saving) setDialog(null);
  }, [saving]);

  const handleGenerateReceipt = useCallback(async (transaction) => {
    if (!transaction?.id) {
      showToast("Please select a transaction before generating a receipt.");
      return;
    }

    setReceiptGeneratingId(transaction.id);

    try {
      await generateTransactionReceiptPdf(transaction);
      setReceiptModalOpen(false);
      showToast(`Receipt downloaded for ${transaction.id}.`);
    } catch (err) {
      showToast(err.message || "Unable to generate the receipt.");
    } finally {
      setReceiptGeneratingId("");
    }
  }, [showToast]);

  const handleDialogConfirm = useCallback(async () => {
    if (!dialog) return;

    const { actionType, booking, transaction, nextStatus } = dialog;
    setSaving(true);

    try {
      if (actionType === "accept_booking") {
        const nextTxnStatus = mapBookingStatusToTransactionStatus(
          booking.type,
          "scheduled",
          transaction?.status,
        );

        const [{ error: bookingError }, { error: transactionError }] = await Promise.all([
          supabase.from("bookings").update({ status: "scheduled" }).eq("id", booking.id),
          supabase.from("transactions").update({ status: nextTxnStatus }).eq("id", transaction.id),
        ]);

        if (bookingError) throw bookingError;
        if (transactionError) throw transactionError;

        if (staffProfile?.id) {
          const receiver = booking.type === "dropoff" ? transaction.seller_id : transaction.buyer_id;
          await insertMessage({
            sender_id: staffProfile.id,
            receiver_id: receiver,
            content: `Your ${booking.type === "dropoff" ? "drop-off" : "collection"} booking for "${booking.itemName}" at ${booking.location || "the trade facility"} on ${formatDate(booking.scheduledDate)} at ${booking.scheduledTime} has been approved.`,
          });
        }

        showToast(`Booking accepted and scheduled for ${booking.personName}.`);
      } else if (actionType === "decline_booking") {
        const [{ error: bookingError }, { error: transactionError }] = await Promise.all([
          supabase.from("bookings").delete().eq("id", booking.id),
          booking.type === "collection"
            ? supabase.from("transactions").update({ status: "item_received", collection_id: null }).eq("id", transaction.id)
            : Promise.resolve({ error: null }),
        ]);

        if (bookingError) throw bookingError;
        if (transactionError) throw transactionError;

        if (staffProfile?.id) {
          const receiver = booking.type === "dropoff" ? transaction.seller_id : transaction.buyer_id;
          await insertMessage({
            sender_id: staffProfile.id,
            receiver_id: receiver,
            content: `Your ${booking.type === "dropoff" ? "drop-off" : "collection"} booking for "${booking.itemName}" was declined. Please choose a different slot in My Bookings.`,
          });
        }

        showToast(`Booking declined for ${booking.personName}.`);
      } else if (actionType === "managed_action") {
        const updatePayload = { status: nextStatus };

        if (nextStatus === "completed") {
          updatePayload.buyer_rating_pending = true;
          updatePayload.seller_rating_pending = true;
        }

        const { error: transactionError } = await supabase
          .from("transactions")
          .update(updatePayload)
          .eq("id", transaction.id);

        if (transactionError) throw transactionError;

        if (nextStatus === "completed" && transaction.collectionId) {
          await supabase
            .from("bookings")
            .update({ status: "completed" })
            .eq("id", transaction.collectionId);
        }

        if (nextStatus === "completed") {
          await supabase
            .from("transactions")
            .update({
              buyer_rating_pending: true,
              seller_rating_pending: true,
            })
            .eq("id", transaction.id);
        }

        if (nextStatus === "completed" && transaction.transaction_type === "item_trade" && staffProfile?.id) {
        await Promise.all([
          insertMessage({
            sender_id: staffProfile.id,
            receiver_id: transaction.seller_id,
            content: `Your trade for "${transaction.item}" is complete. Thank you for using CampusXChange!`,
          }),
          insertMessage({
            sender_id: staffProfile.id,
            receiver_id: transaction.buyer_id,
            content: `Your trade for "${transaction.item}" is complete. Thank you for using CampusXChange!`,
          }),
        ]);
      }

        if (staffProfile?.id) {
          const isTrade = transaction.transaction_type === "item_trade";

          if (nextStatus === "completed" && isTrade) {
            // Message both parties for trade completion
            await Promise.all([
              insertMessage({
                sender_id: staffProfile.id,
                receiver_id: transaction.seller_id,
                content: `Your trade for "${transaction.item}" is complete. Thank you for using CampusXChange!`,
              }),
              insertMessage({
                sender_id: staffProfile.id,
                receiver_id: transaction.buyer_id,
                content: `Your trade for "${transaction.item}" is complete. Thank you for using CampusXChange!`,
              }),
            ]);
          } else {
            const messages = {
              item_received: { to: transaction.buyer_id, text: `Your item "${transaction.item}" has been checked in. You can now pay in My Bookings. Collection booking opens after payment is confirmed.` },
              awaiting_collection: { to: transaction.buyer_id, text: `Your item "${transaction.item}" is ready for collection at ${transaction.collectionFacility || transaction.dropoffFacility || "the seller's drop-off facility"}.` },
              item_released: { to: transaction.seller_id, text: `Your item "${transaction.item}" has been collected by the buyer. The transaction is almost complete.` },
              completed: { to: transaction.seller_id, text: `Transaction for "${transaction.item}" is now fully completed. Thank you for using CampusXChange!` },
            };
            const msg = messages[nextStatus];
            if (msg?.to && msg?.text) {
              await insertMessage({ sender_id: staffProfile.id, receiver_id: msg.to, content: msg.text });
            }
          }
        }

        showToast(`Transaction moved to "${STATUS_META[nextStatus]?.label || nextStatus}".`);
      }

      setDialog(null);
      await loadDashboard();
    } catch (err) {
      showToast(err.message || "Unable to complete the action.");
    } finally {
      setSaving(false);
    }
  }, [dialog, loadDashboard, showToast, staffProfile?.id]);

  const pendingDropoffs = bookings.filter((booking) => booking.type === "dropoff" && booking.status === "scheduled").length;
  const pendingCollections = bookings.filter((booking) => booking.type === "collection" && booking.status === "scheduled").length;
  const pendingMeetups = transactions.filter((t) => t.status === "awaiting_meetup").length;
  const managedCount = transactions.filter((transaction) => MANAGED_STATUSES.includes(transaction.status)).length;
  const dateLabel = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const [isDarkMode, setIsDarkMode] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  function handleDarkMode(val) {
    setIsDarkMode(val);
    if (val) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  const badgeFor = (key) => {
    if (key === "dropoffs") return pendingDropoffs;
    if (key === "collections") return pendingCollections;
    if (key === "manage") return managedCount;
    if (key === "meetups") return pendingMeetups;
    return 0;
  };

  const viewTitles = {
    overview: "Dashboard Overview",
    dropoffs: "Drop-off Bookings",
    collections: "Collection Bookings",
    manage: "Manage Bookings",
    transactions: "Transaction Ledger",
    meetups: "Trade Meetups",
  };

  const viewDescriptions = {
    overview: "Monitor live facility throughput, operational pressure, and recent trade activity.",
    dropoffs: "Review scheduled seller arrivals and prepare for item intake at the facility.",
    collections: "Review scheduled buyer pickups and keep collection handovers moving cleanly.",
    manage: "Advance accepted trades through physical receipt, release, and final completion.",
    transactions: "Audit the full staff ledger and adjust lifecycle statuses without leaving the dashboard.",
    meetups: "Monitor scheduled item-for-item swaps and confirm completed meetups.",
  };

  return (
    <section className="staff-dashboard-shell">
      <span className={`staff-dashboard-backdrop ${isNavOpen ? "staff-dashboard-backdrop--visible" : ""}`} onClick={() => setIsNavOpen(false)} aria-hidden="true" />

      <aside className={`sidebar ${isNavOpen ? "sidebar--open" : ""}`}>
        <header className="sidebar__brand">
          <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="CAMPUSXCHANGE Logo" className="sidebar__logo" />
          <section className="sidebar__brand-text">
            <p className="sidebar__app-name">CAMPUSXCHANGE</p>
            <p className="sidebar__role">Trade Facility</p>
          </section>
          <button type="button" className="sidebar__close" onClick={() => setIsNavOpen(false)} aria-label="Close navigation">
            <Icon name="close" className="sidebar__close-icon" />
          </button>
        </header>

        <nav aria-label="Dashboard navigation" className="sidebar__nav-wrap">
          <ul className="sidebar__nav" role="list">
            {NAV_ITEMS.map((item) => {
              const badge = badgeFor(item.key);
              return (
                <li key={item.key}>
                  <button
                    className={`sidebar__nav-btn ${activeView === item.key ? "sidebar__nav-btn--active" : ""}`}
                    onClick={() => setActiveView(item.key)}
                    aria-current={activeView === item.key ? "page" : undefined}
                  >
                    <span className="sidebar__nav-icon" aria-hidden="true">
                      <Icon name={item.icon} className="sidebar__nav-icon-svg" />
                    </span>
                    <span className="sidebar__nav-label">{item.label}</span>
                    {badge > 0 ? (
                      <span className="sidebar__nav-badge" aria-label={`${badge} pending`}>{badge}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <footer className="sidebar__footer">
          <span className="staff-avatar" aria-hidden="true">
            {initials(staffProfile?.display_name || staffProfile?.name || "Staff")}
          </span>
          <section className="staff-info">
            <p className="staff-name">{staffProfile?.display_name || staffProfile?.name || "Staff"}</p>
            <p className="staff-email">{staffProfile?.email || "staff@campusxchange"}</p>
          </section>
          {onSignOut ? (
            <button className="sidebar__signout-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
              <Icon name="close" className="sidebar__signout-icon" />
            </button>
          ) : null}
        </footer>
      </aside>

      <main className="dashboard-main" id="main-content">
        <header className="dashboard-topbar">
          <section className="topbar-left">
            <header className="topbar-row">
              <button type="button" className="topbar-menu-btn" onClick={() => setIsNavOpen(true)} aria-label="Open navigation">
                <Icon name="menu" className="topbar-menu-btn__icon" />
              </button>
              <section>
                <p className="topbar-eyebrow">Staff Workspace</p>
                <h1 className="topbar-title">{viewTitles[activeView]}</h1>
              </section>
            </header>
            <p className="topbar-date">{dateLabel}</p>
            <p className="topbar-description">{viewDescriptions[activeView]}</p>
          </section>

          <section className="topbar-right">
            <span className="facility-open-badge">
              <span className="facility-open-dot" aria-hidden="true" />
              Facility Open
            </span>
            <button
              type="button"
              className="topbar-theme-chip"
              onClick={() => handleDarkMode(!isDarkMode)}
              aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
            <Icon name={isDarkMode ? "moon" : "sun"} className="topbar-theme-chip__icon" />
                          {isDarkMode ? "Dark mode" : "Light mode"}
            </button>
          </section>
        </header>

        {loading && activeView !== "transactions" ? <section className="panel panel--feedback">Loading facility activity...</section> : null}
        {!loading && error ? <section className="panel panel--feedback">{error}</section> : null}

        {!loading && !error && activeView === "overview" ? (
          <OverviewSection transactions={transactions} bookings={bookings} />
        ) : null}

        {!loading && !error && activeView === "dropoffs" ? (
          <BookingsSection
            type="dropoff"
            bookings={bookings}
            transactions={transactions}
            onAccept={handleAccept}
            onDecline={handleDecline}
            savingIds={savingIds}
          />
        ) : null}

        {!loading && !error && activeView === "collections" ? (
          <BookingsSection
            type="collection"
            bookings={bookings}
            transactions={transactions}
            onAccept={handleAccept}
            onDecline={handleDecline}
            savingIds={savingIds}
          />
        ) : null}

        {!loading && !error && activeView === "manage" ? (
          <ManageBookingsSection
            transactions={transactions}
            bookings={bookings}
            onAction={handleManagedAction}
            savingIds={savingIds}
          />
        ) : null}

        {!error && activeView === "transactions" ? (
          <TransactionsSection
            transactions={transactions}
            bookings={bookings}
            loading={loading}
            onTransactionStatusChange={handleTransactionStatusChange}
            statusSavingIds={savingIds}
            onOpenReceiptModal={() => setReceiptModalOpen(true)}
            onGenerateReceipt={handleGenerateReceipt}
          />
        ) : null}

        {!loading && !error && activeView === "meetups" ? (
        <MeetupsSection
          transactions={transactions.filter((t) => t.status === "awaiting_meetup")}
          bookings={bookings}
          staffProfile={staffProfile}
          onAction={handleManagedAction}
          savingIds={savingIds}
        />
      ) : null}
      </main>

      <UtilityRail transactions={transactions} bookings={bookings} activeView={activeView} />

      {dialog ? (
        <ConfirmDialog
          dialog={dialog}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
          saving={saving}
        />
      ) : null}

      {receiptModalOpen ? (
        <ReceiptModal
          transactions={transactions}
          generatingId={receiptGeneratingId}
          onGenerate={handleGenerateReceipt}
          onClose={() => {
            if (!receiptGeneratingId) setReceiptModalOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
