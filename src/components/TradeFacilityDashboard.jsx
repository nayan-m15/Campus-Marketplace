import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { insertMessage } from "../utils/messageDelivery";
import { deriveBookingStatus } from "../utils/tradeWorkflow";
import ReceiptModal from "./ReceiptModal";
import { generateTransactionReceiptPdf } from "../utils/receiptPdf";
import "../styles/TradeFacilityDashboard.css";

// ---------------------------------------------------------------------------
// Constants & meta
// ---------------------------------------------------------------------------

const STATUS_META = {
  awaiting_dropoff:            { label: "Awaiting Drop-off",          cls: "status--awaiting-dropoff",   icon: "⏳" },
  item_received:               { label: "Item Received",              cls: "status--item-received",       icon: "📦" },
  collection_pending_approval: { label: "Collection Pending Approval",cls: "status--awaiting-collection", icon: "📝" },
  awaiting_collection:         { label: "Awaiting Collection",        cls: "status--awaiting-collection", icon: "🔔" },
  item_released:               { label: "Item Released",              cls: "status--completed",           icon: "🏁" },
  completed:                   { label: "Completed",                  cls: "status--completed",           icon: "🏁" },
  cancelled:                   { label: "Cancelled",                  cls: "status--cancelled",           icon: "✕"  },
};

const BOOKING_STATUS_META = {
  scheduled:        { label: "Scheduled",        cls: "bstatus--scheduled"  },
  pending_approval: { label: "Pending Approval", cls: "bstatus--scheduled"  },
  completed:        { label: "Completed",        cls: "bstatus--completed"  },
  cancelled:        { label: "Cancelled",        cls: "bstatus--no-show"    },
};

// Active transaction lifecycle states shown in Manage Bookings
const MANAGED_STATUSES = ["awaiting_dropoff", "item_received", "awaiting_collection", "item_released"];

// ---------------------------------------------------------------------------
// Navigation — includes new "Manage Bookings" tab
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { key: "overview",    label: "Overview",          icon: "🏠" },
  { key: "dropoffs",    label: "Drop-off Bookings", icon: "📥" },
  { key: "collections", label: "Collection Bookings",icon: "📤" },
  { key: "manage",      label: "Manage Bookings",   icon: "⚙️"  },
  { key: "transactions",label: "All Transactions",  icon: "📋" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapBookingStatusToTransactionStatus(bookingType, bookingStatus, currentStatus) {
  if (bookingType === "dropoff") {
    if (bookingStatus === "completed") return "item_received";
    if (["scheduled", "pending_approval", "cancelled"].includes(bookingStatus)) return "awaiting_dropoff";
  }
  if (bookingType === "collection") {
    if (bookingStatus === "pending_approval" || bookingStatus === "cancelled") return "item_received";
    if (bookingStatus === "scheduled")  return "awaiting_collection";
    if (bookingStatus === "completed")  return "item_released";
  }
  return currentStatus;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatDateTime(timestamp) {
  if (!timestamp) return { date: "-", time: "-" };
  const date = new Date(timestamp);
  return {
    date: date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }),
  };
}

function initials(name) {
  return (name || "?").split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function buildListingMatchKey(userId, itemName) {
  return `${userId || ""}::${String(itemName || "").trim().toLowerCase()}`;
}

function buildBookings(transactions, profilesById, bookingsById) {
  const output = [];

  for (const transaction of transactions) {
    const sellerProfile = profilesById[transaction.seller_id] || {};
    const buyerProfile  = profilesById[transaction.buyer_id]  || {};

    if (transaction.dropoff_id && bookingsById[transaction.dropoff_id]) {
      const booking = bookingsById[transaction.dropoff_id];
      const when    = formatDateTime(booking.scheduled_time);
      output.push({
        id:             booking.id,
        type:           "dropoff",
        transactionId:  transaction.id,
        personName:     sellerProfile.display_name || sellerProfile.name || transaction.seller_id,
        studentId:      sellerProfile.email || transaction.seller_id,
        role:           "seller",
        scheduledDate:  booking.scheduled_time?.slice(0, 10) || "",
        scheduledTime:  booking.scheduled_time?.slice(11, 16) || when.time,
        status:         booking.status || deriveBookingStatus("dropoff", transaction.status),
        itemName:       transaction.item,
        location:       booking.location,
      });
    }

    if (transaction.collection_id && bookingsById[transaction.collection_id]) {
      const booking = bookingsById[transaction.collection_id];
      const when    = formatDateTime(booking.scheduled_time);
      output.push({
        id:             booking.id,
        type:           "collection",
        transactionId:  transaction.id,
        personName:     buyerProfile.display_name || buyerProfile.name || transaction.buyer_id,
        studentId:      buyerProfile.email || transaction.buyer_id,
        role:           "buyer",
        scheduledDate:  booking.scheduled_time?.slice(0, 10) || "",
        scheduledTime:  booking.scheduled_time?.slice(11, 16) || when.time,
        status:         booking.status || deriveBookingStatus("collection", transaction.status),
        itemName:       transaction.item,
        location:       booking.location,
      });
    }
  }

  return output.sort((a, b) => {
    const aTime = new Date(`${a.scheduledDate}T${a.scheduledTime || "00:00"}`);
    const bTime = new Date(`${b.scheduledDate}T${b.scheduledTime || "00:00"}`);
    return aTime - bTime;
  });
}

// ---------------------------------------------------------------------------
// Shared UI atoms
// ---------------------------------------------------------------------------

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, cls: "", icon: "•" };
  return (
    <span className={`status-badge ${meta.cls}`}>
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function BookingStatusBadge({ status }) {
  const meta = BOOKING_STATUS_META[status] || { label: status, cls: "" };
  return <span className={`booking-status-badge ${meta.cls}`}>{meta.label}</span>;
}

function Avatar({ name, size = "md" }) {
  return (
    <span className={`avatar avatar--${size}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <section className="empty-state" aria-label={title}>
      <span className="empty-state__icon" aria-hidden="true">{icon}</span>
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__description">{description}</p>
    </section>
  );
}

function StatCard({ icon, iconColor, value, label, subLabel }) {
  return (
    <article className="stat-card">
      <header className="stat-card__top">
        <span className={`stat-card__icon stat-card__icon--${iconColor}`} aria-hidden="true">{icon}</span>
      </header>
      <p className="stat-card__value">{value}</p>
      <footer className="stat-card__footer">
        <p className="stat-card__label">{label}</p>
        {subLabel ? <p className="stat-card__sublabel">{subLabel}</p> : null}
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// BookingCard — used in Drop-off & Collection tabs (pending_approval only)
// ---------------------------------------------------------------------------

/**
 * In the request tabs (Drop-off / Collection) a booking is always
 * `pending_approval`.  Staff can only Accept or Decline — no status dropdown.
 */
function BookingCard({ booking, transaction, onAccept, onDecline, saving }) {
  const isDropoff = booking.type === "dropoff";

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
        </ul>
      </section>

      <footer className="booking-card__footer">
        <menu className="booking-card__actions" role="list">
          <li>
            <button
              className="btn-action btn-action--receipt"
              onClick={() => onAccept(booking, transaction)}
              disabled={saving}
            >
              <span aria-hidden="true">✓</span> Accept Booking
            </button>
          </li>
          <li>
            <button
              className="btn-action btn-action--noshow"
              onClick={() => onDecline(booking, transaction)}
              disabled={saving}
            >
              Decline Booking
            </button>
          </li>
        </menu>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// ManagedTransactionCard — used in the Manage Bookings tab
// Shows guided action buttons based on transaction lifecycle state.
// ---------------------------------------------------------------------------

function ManagedTransactionCard({ transaction, bookings, onAction, saving }) {
  const { status } = transaction;

  const dropoffBooking   = bookings.find((b) => b.id === transaction.dropoffId);
  const collectionBooking = bookings.find((b) => b.id === transaction.collectionId);

  // Derive the contextual next action
  const getAction = () => {
    switch (status) {
      case "awaiting_dropoff":
        return {
          label:  "Mark Item Received",
          icon:   "📦",
          cls:    "btn-action--receipt",
          next:   "item_received",
          hint:   "Confirm the seller has handed the item over.",
        };
      case "item_received":
        // No manual button — collection booking approval drives the next step.
        return null;
      case "awaiting_collection":
        return {
          label: "Confirm Collection",
          icon:  "↑",
          cls:   "btn-action--release",
          next:  "item_released",
          hint:  "Confirm the buyer has collected the item.",
        };
      case "item_released":
        return {
          label: "Mark Transaction Complete",
          icon:  "🏁",
          cls:   "btn-action--receipt",
          next:  "completed",
          hint:  "Close the transaction and archive it.",
        };
      default:
        return null;
    }
  };

  const action = getAction();

 
  return (
    <article className="booking-card managed-card">
      {/* Header */}
      <header className="booking-card__header">
        <section className="booking-card__header-left">
          <section className="booking-card__person-info">
            <p className="booking-card__person-name">{transaction.item}</p>
            <p className="booking-card__person-meta booking-card__txn-id">{transaction.id}</p>
          </section>
        </section>
        <section className="booking-card__header-right">
          <StatusBadge status={status} />
        </section>
      </header>

      

      {/* Detail grid */}
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
            <span className="booking-card__detail-label">Value</span>
            <span className="booking-card__detail-value">
              R {Number(transaction.price || 0).toLocaleString("en-ZA")}
            </span>
          </li>
          {dropoffBooking ? (
            <li className="booking-card__detail">
              <span className="booking-card__detail-label">Drop-off</span>
              <span className="booking-card__detail-value">
                {formatDate(dropoffBooking.scheduledDate)} {dropoffBooking.scheduledTime}
                <BookingStatusBadge status={dropoffBooking.status} />
              </span>
            </li>
          ) : null}
          {collectionBooking ? (
            <li className="booking-card__detail">
              <span className="booking-card__detail-label">Collection</span>
              <span className="booking-card__detail-value">
                {formatDate(collectionBooking.scheduledDate)} {collectionBooking.scheduledTime}
                <BookingStatusBadge status={collectionBooking.status} />
              </span>
            </li>
          ) : null}
          {/* item_received: show that we're awaiting a collection booking */}
          {status === "item_received" ? (
            <li className="booking-card__detail">
              <span className="booking-card__detail-label">Next step</span>
              <span className="booking-card__detail-value managed-card__hint">
                ⏳ Waiting for buyer to submit a collection booking request.
              </span>
            </li>
          ) : null}
          {action?.hint ? (
            <li className="booking-card__detail">
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
                <span aria-hidden="true">{action.icon}</span> {action.label}
              </button>
            </li>
          </menu>
        </footer>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------

function ConfirmDialog({ dialog, onConfirm, onCancel, saving }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  if (!dialog) return null;

  const isAccept  = dialog.actionType === "accept_booking";
  const isDecline = dialog.actionType === "decline_booking";

  const titles = {
    accept_booking:  "Accept Booking Request",
    decline_booking: "Decline Booking Request",
    managed_action:  `Confirm: ${STATUS_META[dialog.nextStatus]?.label || dialog.nextStatus}`,
  };

  const subtitles = {
    accept_booking:  "This will schedule the booking and move it to Manage Bookings.",
    decline_booking: "This will cancel and remove the booking request.",
    managed_action:  `Update the transaction to "${STATUS_META[dialog.nextStatus]?.label || dialog.nextStatus}".`,
  };

  return (
    <dialog ref={ref} className="confirm-dialog" onClose={onCancel}>
      <header className="confirm-dialog__header">
        <span className="confirm-dialog__icon" aria-hidden="true">
          {isAccept ? "✓" : isDecline ? "⚠️" : "⚙️"}
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
          {saving ? "Saving…" : isAccept ? "Accept" : isDecline ? "Decline" : "Confirm"}
        </button>
      </footer>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// OverviewSection
// ---------------------------------------------------------------------------

function OverviewSection({ transactions, bookings }) {
  const pendingRequests   = bookings.filter((b) => b.status === "pending_approval").length;
  const managed           = transactions.filter((t) => MANAGED_STATUSES.includes(t.status)).length;
  const awaitingDropoff   = transactions.filter((t) => t.status === "awaiting_dropoff").length;
  const awaitingCollection= transactions.filter((t) => t.status === "awaiting_collection").length;
  const completedAll      = transactions.filter((t) => t.status === "completed").length;

  return (
    <section className="view-section">
      <article className="panel">
        <header className="panel__header">
          <section>
            <h3 className="panel__title">Facility Activity</h3>
            <p className="panel__subtitle">Live trade handover progress from bookings and transactions.</p>
          </section>
        </header>
        <ul className="stats-grid" role="list">
          <li><StatCard icon="📝" iconColor="amber"  value={pendingRequests}    label="Pending Requests"       subLabel="Bookings awaiting staff approval" /></li>
          <li><StatCard icon="⚙️"  iconColor="blue"   value={managed}            label="Active in Manage"       subLabel="Transactions in progress" /></li>
          <li><StatCard icon="📥" iconColor="amber"  value={awaitingDropoff}    label="Awaiting Drop-off"      subLabel="Seller still needs to arrive" /></li>
          <li><StatCard icon="🔔" iconColor="blue"   value={awaitingCollection} label="Ready for Collection"   subLabel="Approved buyers can now arrive" /></li>
          <li><StatCard icon="✅" iconColor="green"  value={completedAll}       label="Completed Transactions" subLabel="Fully closed trades" /></li>
        </ul>
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// BookingsSection — Drop-off & Collection request tabs (pending_approval only)
// ---------------------------------------------------------------------------

function BookingsSection({
  type,
  bookings,
  transactions,
  onAccept,
  onDecline,
  savingIds,
}) {
  const [search, setSearch] = useState("");
  const label = type === "dropoff" ? "Drop-off" : "Collection";

  // Only show pending_approval bookings of the right type
  const filtered = bookings.filter((b) => {
    if (b.type !== type) return false;
    if (b.status !== "pending_approval") return false;
    if (!search.trim()) return true;
    const hay = [b.personName, b.itemName, b.studentId, b.transactionId, b.location]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <section className="view-section" aria-labelledby={`${type}-heading`}>
      <h2 id={`${type}-heading`} className="sr-only">{label} Booking Requests</h2>

      <article className="panel">
        <header className="panel__header">
          <section>
            <h3 className="panel__title">{label} Requests</h3>
            <p className="panel__subtitle">
              {type === "dropoff"
                ? "Review and approve seller drop-off requests before scheduling."
                : "Review and approve buyer collection requests before scheduling."}
            </p>
          </section>
          {filtered.length > 0 ? (
            <p className="panel__count">{filtered.length} pending</p>
          ) : null}
        </header>

        <section className="bookings-controls">
          <label htmlFor={`${type}-search`} className="sr-only">Search bookings</label>
            <input
            id={`${type}-search`}
            type="search"
            className="bookings-search"
            placeholder="Search by name, item, or transaction ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </section>

        {filtered.length === 0 ? (
          <EmptyState
            icon="📭"
            title="No pending requests"
            description="New booking requests will appear here once students submit them."
          />
        ) : (
          <ul className="booking-list" role="list">
            {filtered.map((booking) => {
              const transaction = transactions.find((t) => t.id === booking.transactionId);
              return (
                <li key={booking.id}>
                  <BookingCard
                    booking={booking}
                    transaction={transaction}
                    onAccept={onAccept}
                    onDecline={onDecline}
                    saving={Boolean(savingIds[booking.id])}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ManageBookingsSection — accepted bookings / active transactions
// ---------------------------------------------------------------------------

function ManageBookingsSection({ transactions, bookings, onAction, savingIds }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Only show transactions in the active lifecycle
  const managed = useMemo(() =>
    transactions.filter((t) => MANAGED_STATUSES.includes(t.status)),
    [transactions]
  );

  const filtered = useMemo(() => managed.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const hay = [t.id, t.item, t.seller?.name, t.buyer?.name]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(search.toLowerCase());
  }), [managed, search, statusFilter]);

  const STATUS_FILTER_OPTIONS = [
    { value: "all",                 label: "All Active"           },
    { value: "awaiting_dropoff",    label: "Awaiting Drop-off"    },
    { value: "item_received",       label: "Item Received"        },
    { value: "awaiting_collection", label: "Awaiting Collection"  },
    { value: "item_released",       label: "Item Released"        },
  ];

  return (
    <section className="view-section" aria-labelledby="manage-heading">
      <h2 id="manage-heading" className="sr-only">Manage Bookings</h2>

      <article className="panel">
        <header className="panel__header">
          <section>
            <h3 className="panel__title">Manage Bookings</h3>
            <p className="panel__subtitle">
              Move accepted transactions through the handover lifecycle — from drop-off to collection to completion.
            </p>
          </section>
          <p className="panel__count">{filtered.length} of {managed.length} active</p>
        </header>

        <section className="bookings-controls bookings-controls--row">
          <label htmlFor="manage-search" className="sr-only">Search transactions</label>
            <input
            id="manage-search"
            type="search"
            className="bookings-search"
            placeholder="Search by item, buyer, seller, or transaction ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="status-select-wrap" htmlFor="manage-filter">
            <span className="sr-only">Filter by status</span>
            <select
              id="manage-filter"
              className="status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </section>

        {filtered.length === 0 ? (
          <EmptyState
            icon="⚙️"
            title="No active transactions"
            description="Accepted bookings will appear here, ready to move through the handover lifecycle."
          />
        ) : (
          <ul className="booking-list" role="list">
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

// ---------------------------------------------------------------------------
// TransactionsSection — archive / full ledger
// ---------------------------------------------------------------------------

function TransactionsSection({
  transactions,
  bookings,
  onTransactionStatusChange,
  statusSavingIds,
  onOpenReceiptModal,
}) {
  const [search, setSearch] = useState("");

  const TRANSACTION_STATUS_OPTIONS = [
    "awaiting_dropoff",
    "item_received",
    "awaiting_collection",
    "item_released",
    "completed",
    "cancelled",
  ];

  const filtered = useMemo(() => transactions.filter((t) => {
    if (!search.trim()) return true;
    const hay = [t.id, t.item, t.seller.name, t.buyer.name]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(search.toLowerCase());
  }), [search, transactions]);

  return (
    <section className="view-section" aria-labelledby="transactions-heading">
      <h2 id="transactions-heading" className="sr-only">All Transactions</h2>

      <article className="panel">
        <header className="panel__header">
          <section>
            <h3 className="panel__title">All Transactions</h3>
            <p className="panel__subtitle">Full ledger of all accepted offers across every lifecycle stage.</p>
          </section>
          <p className="panel__count">{filtered.length} of {transactions.length} transactions</p>
        </header>

        <section className="bookings-controls transactions-toolbar">
          <div className="transactions-toolbar__search">
            <label htmlFor="txn-search" className="sr-only">Search transactions</label>
          <input
            id="txn-search"
            type="search"
            className="bookings-search"
            placeholder="Search by transaction ID, item, buyer or seller…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" className="btn-primary" onClick={onOpenReceiptModal}>
            <span aria-hidden="true">Receipt</span>
            Generate Receipt
          </button>
        </section>

        {filtered.length === 0 ? (
          <EmptyState icon="🔍" title="No transactions found" description="Accepted offers will appear here." />
        ) : (
          <figure className="table-figure" role="group" aria-label="Transactions table">
            <table className="report-table transactions-table">
              <thead>
                <tr>
                  <th scope="col">Transaction</th>
                  <th scope="col">Item</th>
                  <th scope="col">Seller</th>
                  <th scope="col">Buyer</th>
                  <th scope="col">Value</th>
                  <th scope="col">Status</th>
                  <th scope="col">Drop-off</th>
                  <th scope="col">Collection</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((transaction) => {
                  const dropoff    = bookings.find((b) => b.id === transaction.dropoffId);
                  const collection = bookings.find((b) => b.id === transaction.collectionId);
                  return (
                    <tr key={transaction.id}>
                      <td>
                        <span className="txn-id-chip">{transaction.id}</span>
                        <p className="txn-date">{formatDate(transaction.createdAt?.slice(0, 10) || "")}</p>
                      </td>
                      <td className="txn-item">{transaction.item}</td>
                      <td>
                        <section className="txn-person">
                          <Avatar name={transaction.seller.name} size="sm" />
                          <section>
                            <p className="txn-person__name">{transaction.seller.name}</p>
                            <p className="txn-person__id">{transaction.seller.studentId}</p>
                          </section>
                        </section>
                      </td>
                      <td>
                        <section className="txn-person">
                          <Avatar name={transaction.buyer.name} size="sm" />
                          <section>
                            <p className="txn-person__name">{transaction.buyer.name}</p>
                            <p className="txn-person__id">{transaction.buyer.studentId}</p>
                          </section>
                        </section>
                      </td>
                      <td className="txn-price">R {Number(transaction.price || 0).toLocaleString("en-ZA")}</td>
                      <td>
                        <div className="txn-status-stack">
                          <StatusBadge status={transaction.status} />
                          <label className="status-select-wrap">
                            <span className="sr-only">Update transaction status</span>
                            <select
                              className="status-select status-select--compact"
                              value={transaction.status}
                              onChange={(e) => onTransactionStatusChange(transaction.id, e.target.value)}
                              disabled={Boolean(statusSavingIds[transaction.id])}
                            >
                              {TRANSACTION_STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </td>
                      <td>
                        {dropoff ? (
                          <section className="txn-booking-cell">
                            <p>{formatDate(dropoff.scheduledDate)}</p>
                            <p className="txn-booking-time">{dropoff.scheduledTime}</p>
                            <BookingStatusBadge status={dropoff.status} />
                          </section>
                        ) : <span className="txn-na">-</span>}
                      </td>
                      <td>
                        {collection ? (
                          <section className="txn-booking-cell">
                            <p>{formatDate(collection.scheduledDate)}</p>
                            <p className="txn-booking-time">{collection.scheduledTime}</p>
                            <BookingStatusBadge status={collection.status} />
                          </section>
                        ) : <span className="txn-na">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </figure>
        )}
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function TradeFacilityDashboard({ onSignOut, staffProfile }) {
  const [activeView, setActiveView]       = useState("overview");
  const [transactions, setTransactions]   = useState([]);
  const [bookings, setBookings]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [dialog, setDialog]               = useState(null);
  const [saving, setSaving]               = useState(false);
  const [savingIds, setSavingIds]         = useState({});
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptGeneratingId, setReceiptGeneratingId] = useState("");
  const [toast, setToast]                 = useState({ msg: "", visible: false });
  const toastTimer                        = useRef(null);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast({ msg, visible: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg: "", visible: false }), 3200);
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: txRows, error: txErr } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (txErr) throw txErr;

      const rows       = txRows || [];
      const bookingIds = [...new Set(rows.flatMap((r) => [r.dropoff_id, r.collection_id]).filter(Boolean))];
      const profileIds = [...new Set(rows.flatMap((r) => [r.seller_id,  r.buyer_id]).filter(Boolean))];
      const sellerIds  = [...new Set(rows.map((r) => r.seller_id).filter(Boolean))];

      const [
        { data: bookingRows, error: bErr },
        { data: profileRows, error: pErr },
        { data: listingRows, error: lErr },
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

      if (bErr) throw bErr;
      if (pErr) throw pErr;
      if (lErr) throw lErr;

      const profilesById = Object.fromEntries((profileRows || []).map((p) => [p.id, p]));
      const bookingsById = Object.fromEntries((bookingRows || []).map((b) => [b.id, b]));
      const listingMatches = new Map();

      for (const listing of listingRows || []) {
        const key = buildListingMatchKey(listing.user_id, listing.title);
        if (!listingMatches.has(key)) {
          listingMatches.set(key, listing);
        }
      }

      const mappedTransactions = rows.map((t) => {
        const matchedListing = listingMatches.get(buildListingMatchKey(t.seller_id, t.item)) || null;

        return {
          ...t,
          listing_id: matchedListing?.id || null,
          dropoffId:    t.dropoff_id,
          collectionId: t.collection_id,
          createdAt:    t.created_at,
          matchedListing,
          itemDescription: matchedListing?.description || "",
          itemImageUrl: matchedListing?.image_url || matchedListing?.image_urls?.find(Boolean) || "",
          quantity: Number(t.quantity || 1),
          totalAmount: Number(t.total_amount ?? t.price ?? 0),
          paymentMethod: t.payment_method || "",
          seller: {
            name:      profilesById[t.seller_id]?.display_name || profilesById[t.seller_id]?.name || t.seller_id,
            studentId: profilesById[t.seller_id]?.email || t.seller_id,
          },
          buyer: {
            name:      profilesById[t.buyer_id]?.display_name || profilesById[t.buyer_id]?.name || t.buyer_id,
            studentId: profilesById[t.buyer_id]?.email || t.buyer_id,
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

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    const channel = supabase
      .channel("trade-facility-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, loadDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, loadDashboard)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadDashboard]);

  // ── Accept / Decline booking (Drop-off & Collection tabs) ────────────────
  const handleAccept = useCallback((booking, transaction) => {
    setDialog({ actionType: "accept_booking", booking, transaction });
  }, []);

  const handleDecline = useCallback((booking, transaction) => {
    setDialog({ actionType: "decline_booking", booking, transaction });
  }, []);

  // ── Managed lifecycle action (Manage Bookings tab) ───────────────────────
  const handleManagedAction = useCallback((transaction, nextStatus) => {
    setDialog({ actionType: "managed_action", transaction, nextStatus });
  }, []);

  // ── Manual status change (All Transactions table) ────────────────────────
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
      setSavingIds((prev) => { const n = { ...prev }; delete n[transactionId]; return n; });
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

  // ── Central confirm handler ───────────────────────────────────────────────
  const handleDialogConfirm = useCallback(async () => {
    if (!dialog) return;
    const { actionType, booking, transaction, nextStatus } = dialog;
    setSaving(true);

    try {
      // ── Accept a pending booking request ──────────────────────────────────
      if (actionType === "accept_booking") {
        const nextTxnStatus = mapBookingStatusToTransactionStatus(
          booking.type, "scheduled", transaction?.status
        );

        const [{ error: bErr }, { error: tErr }] = await Promise.all([
          supabase.from("bookings").update({ status: "scheduled" }).eq("id", booking.id),
          supabase.from("transactions").update({ status: nextTxnStatus }).eq("id", transaction.id),
        ]);
        if (bErr) throw bErr;
        if (tErr) throw tErr;

        // Notify the student
        if (staffProfile?.id) {
          const receiver = booking.type === "dropoff" ? transaction.seller_id : transaction.buyer_id;
          await insertMessage({
            sender_id:   staffProfile.id,
            receiver_id: receiver,
            content:     `Your ${booking.type === "dropoff" ? "drop-off" : "collection"} booking for "${booking.itemName}" at ${booking.location || "the trade facility"} on ${formatDate(booking.scheduledDate)} at ${booking.scheduledTime} has been approved.`,
          });
        }

        showToast(`Booking accepted and scheduled for ${booking.personName}.`);

      // ── Decline a pending booking request ────────────────────────────────
      } else if (actionType === "decline_booking") {
        const [{ error: bErr }, { error: tErr }] = await Promise.all([
          supabase.from("bookings").delete().eq("id", booking.id),
          booking.type === "collection"
            ? supabase.from("transactions")
                .update({ status: "item_received", collection_id: null })
                .eq("id", transaction.id)
            : Promise.resolve({ error: null }),
        ]);
        if (bErr) throw bErr;
        if (tErr) throw tErr;

        if (staffProfile?.id) {
          const receiver = booking.type === "dropoff" ? transaction.seller_id : transaction.buyer_id;
          await insertMessage({
            sender_id:   staffProfile.id,
            receiver_id: receiver,
            content:     `Your ${booking.type === "dropoff" ? "drop-off" : "collection"} booking for "${booking.itemName}" was declined. Please choose a different slot in My Bookings.`,
          });
        }

        showToast(`Booking declined for ${booking.personName}.`);

      // ── Move a transaction through its lifecycle (Manage tab) ─────────────
      } else if (actionType === "managed_action") {
        const updatePayload = { status: nextStatus };
          if (nextStatus === "completed") {
            updatePayload.buyer_rating_pending = true;
            updatePayload.seller_rating_pending = true;
          }

        const { error: tErr } = await supabase
          .from("transactions")
          .update(updatePayload)
          .eq("id", transaction.id);
          if (tErr) throw tErr;

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
        // Notify relevant party
        if (staffProfile?.id) {
          const messages = {
            item_received:       { to: transaction.buyer_id,  text: `Your item "${transaction.item}" has been checked in. You can now book your collection slot in My Bookings.` },
            awaiting_collection: { to: transaction.buyer_id,  text: `Your item "${transaction.item}" is ready for collection at the trade facility.` },
            item_released:       { to: transaction.seller_id, text: `Your item "${transaction.item}" has been collected by the buyer. The transaction is almost complete.` },
            completed:           { to: transaction.seller_id, text: `Transaction for "${transaction.item}" is now fully completed. Thank you for using CampusXChange!` },
          };

          const msg = messages[nextStatus];
          if (msg) {
            await insertMessage({
              sender_id:   staffProfile.id,
              receiver_id: msg.to,
              content:     msg.text,
            });
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

  // ── Sidebar badges ────────────────────────────────────────────────────────
  const pendingDropoffs    = bookings.filter((b) => b.type === "dropoff"    && b.status === "pending_approval").length;
  const pendingCollections = bookings.filter((b) => b.type === "collection" && b.status === "pending_approval").length;
  const managedCount       = transactions.filter((t) => MANAGED_STATUSES.includes(t.status)).length;

  const badgeFor = (key) => {
    if (key === "dropoffs")    return pendingDropoffs;
    if (key === "collections") return pendingCollections;
    if (key === "manage")      return managedCount;
    return 0;
  };

  const dateLabel = new Date().toLocaleDateString("en-ZA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const viewTitles = {
    overview:     "Dashboard Overview",
    dropoffs:     "Drop-off Requests",
    collections:  "Collection Requests",
    manage:       "Manage Bookings",
    transactions: "All Transactions",
  };

  return (
    <section className="staff-dashboard-wrapper">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <header className="sidebar__brand">
          <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="CAMPUSXCHANGE Logo" className="sidebar__logo" />
          <section className="sidebar__brand-text">
            <p className="sidebar__app-name">CAMPUSXCHANGE</p>
            <p className="sidebar__role">Trade Facility</p>
          </section>
        </header>

        <nav aria-label="Dashboard navigation">
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
                    <span className="sidebar__nav-icon" aria-hidden="true">{item.icon}</span>
                    {item.label}
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
              ⏻
            </button>
          ) : null}
        </footer>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="dashboard-main" id="main-content">
        <header className="dashboard-topbar">
          <section className="topbar-left">
            <h1 className="topbar-title">{viewTitles[activeView]}</h1>
            <p className="topbar-date">{dateLabel}</p>
          </section>
          <section className="topbar-right">
            <span className="facility-open-badge">
              <span className="facility-open-dot" aria-hidden="true" />
              Facility Open
            </span>
          </section>
        </header>

        {loading ? <div className="panel">Loading facility activity…</div> : null}
        {!loading && error ? <div className="panel">{error}</div> : null}

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

        {!loading && !error && activeView === "transactions" ? (
          <TransactionsSection
            transactions={transactions}
            bookings={bookings}
            onTransactionStatusChange={handleTransactionStatusChange}
            statusSavingIds={savingIds}
            onOpenReceiptModal={() => setReceiptModalOpen(true)}
          />
        ) : null}
      </main>

      {/* ── Confirm dialog ───────────────────────────────────────────────── */}
      {dialog ? (
        <ConfirmDialog
          dialog={dialog}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
          saving={saving}
        />
      ) : null}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
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

      <aside
        className={`save-toast ${toast.visible ? "save-toast--visible" : ""}`}
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        <span className="save-toast__icon" aria-hidden="true">✓</span>
        {toast.msg}
      </aside>
    </section>
  );
}
