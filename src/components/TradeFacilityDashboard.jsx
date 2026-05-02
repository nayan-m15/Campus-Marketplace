import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { insertMessage } from "../utils/messageDelivery";
import { deriveBookingStatus } from "../utils/tradeWorkflow";
import "../styles/TradeFacilityDashboard.css";

const STATUS_META = {
  awaiting_dropoff: { label: "Awaiting Drop-off", cls: "status--awaiting-dropoff", icon: "⏳" },
  item_received: { label: "Item Received", cls: "status--item-received", icon: "📦" },
  collection_pending_approval: { label: "Collection Pending Approval", cls: "status--awaiting-collection", icon: "📝" },
  awaiting_collection: { label: "Awaiting Collection", cls: "status--awaiting-collection", icon: "🔔" },
  item_released: { label: "Item Released", cls: "status--completed", icon: "🏁" },
  completed: { label: "Completed", cls: "status--completed", icon: "🏁" },
  cancelled: { label: "Cancelled", cls: "status--cancelled", icon: "✕" },
};

const BOOKING_STATUS_META = {
  scheduled: { label: "Scheduled", cls: "bstatus--scheduled" },
  pending_approval: { label: "Pending Approval", cls: "bstatus--scheduled" },
  completed: { label: "Completed", cls: "bstatus--completed" },
  cancelled: { label: "Cancelled", cls: "bstatus--no-show" },
};

const TRANSACTION_STATUS_OPTIONS = [
  "awaiting_dropoff",
  "item_received",
  "awaiting_collection",
  "item_released",
];

const BOOKING_STATUS_OPTIONS = [
  "pending_approval",
  "scheduled",
  "completed",
  "cancelled",
];

function mapBookingStatusToTransactionStatus(bookingType, bookingStatus, currentStatus) {
  if (bookingStatus === "cancelled") return "cancelled";

  if (bookingType === "dropoff") {
    if (bookingStatus === "completed") return "item_received";
    if (bookingStatus === "scheduled" || bookingStatus === "pending_approval") {
      return currentStatus === "cancelled" ? "awaiting_dropoff" : currentStatus;
    }
  }

  if (bookingType === "collection") {
    if (bookingStatus === "pending_approval") return "collection_pending_approval";
    if (bookingStatus === "scheduled") return "awaiting_collection";
    if (bookingStatus === "completed") return "item_released";
  }

  return currentStatus;
}

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "🏠" },
  { key: "dropoffs", label: "Drop-off Bookings", icon: "📥" },
  { key: "collections", label: "Collection Bookings", icon: "📤" },
  { key: "transactions", label: "All Transactions", icon: "📋" },
];

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return { date: "-", time: "-" };
  }

  const date = new Date(timestamp);
  return {
    date: date.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

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
        <span className={`stat-card__icon stat-card__icon--${iconColor}`} aria-hidden="true">
          {icon}
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

function buildBookings(transactions, profilesById, bookingsById) {
  const output = [];

  for (const transaction of transactions) {
    const sellerProfile = profilesById[transaction.seller_id] || {};
    const buyerProfile = profilesById[transaction.buyer_id] || {};

    if (transaction.dropoff_id && bookingsById[transaction.dropoff_id]) {
      const booking = bookingsById[transaction.dropoff_id];
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
        status: deriveBookingStatus("dropoff", transaction.status),
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
        status: deriveBookingStatus("collection", transaction.status),
        itemName: transaction.item,
        location: booking.location,
      });
    }
  }

  return output.sort((left, right) => {
    const leftTime = new Date(`${left.scheduledDate}T${left.scheduledTime || "00:00"}`);
    const rightTime = new Date(`${right.scheduledDate}T${right.scheduledTime || "00:00"}`);
    return leftTime - rightTime;
  });
}

function BookingCard({
  booking,
  transaction,
  onConfirmReceipt,
  onApproveCollection,
  onDeclineCollection,
  onConfirmRelease,
  onStatusChange,
  statusSaving,
}) {
  const isDropoff = booking.type === "dropoff";
  const isCollection = booking.type === "collection";
  const isScheduled = booking.status === "scheduled" || booking.status === "pending_approval";
  const isPendingApproval = isCollection && transaction?.status === "collection_pending_approval";
  const canConfirmReceipt = isDropoff && isScheduled && transaction?.status === "awaiting_dropoff";
  const canApproveCollection = isPendingApproval;
  const canDeclineCollection = isPendingApproval;
  const canConfirmRelease = isCollection && booking.status === "scheduled" && transaction?.status === "awaiting_collection";

  return (
    <article className="booking-card">
      <header className="booking-card__header">
        <section className="booking-card__header-left">
          <Avatar name={booking.personName} />
          <section className="booking-card__person-info">
            <p className="booking-card__person-name">{booking.personName}</p>
            <p className="booking-card__person-meta">{booking.studentId} · {booking.role === "seller" ? "Seller" : "Buyer"}</p>
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
            <span className="booking-card__detail-value">{formatDate(booking.scheduledDate)} at {booking.scheduledTime}</span>
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
          <li className="booking-card__detail booking-card__detail--status-control">
            <span className="booking-card__detail-label">Set Status</span>
            <label className="status-select-wrap">
              <span className="sr-only">Update booking status</span>
              <select
                className="status-select"
                value={booking.status}
                onChange={(event) => onStatusChange(booking, transaction, event.target.value)}
                disabled={statusSaving}
              >
                {BOOKING_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {BOOKING_STATUS_META[status]?.label || status}
                  </option>
                ))}
              </select>
            </label>
          </li>
        </ul>
      </section>

      {(canConfirmReceipt || canApproveCollection || canDeclineCollection || canConfirmRelease) ? (
        <footer className="booking-card__footer">
          <menu className="booking-card__actions" role="list">
            {canConfirmReceipt ? (
              <li>
                <button className="btn-action btn-action--receipt" onClick={() => onConfirmReceipt(booking, transaction)}>
                  <span aria-hidden="true">✓</span> Confirm Receipt
                </button>
              </li>
            ) : null}
            {canApproveCollection ? (
              <li>
                <button className="btn-action btn-action--receipt" onClick={() => onApproveCollection(booking, transaction)}>
                  <span aria-hidden="true">✓</span> Approve Booking
                </button>
              </li>
            ) : null}
            {canDeclineCollection ? (
              <li>
                <button className="btn-action btn-action--noshow" onClick={() => onDeclineCollection(booking, transaction)}>
                  Decline Booking
                </button>
              </li>
            ) : null}
            {canConfirmRelease ? (
              <li>
                <button className="btn-action btn-action--release" onClick={() => onConfirmRelease(booking, transaction)}>
                  <span aria-hidden="true">↑</span> Confirm Release
                </button>
              </li>
            ) : null}
          </menu>
        </footer>
      ) : null}
    </article>
  );
}

function ConfirmDialog({ dialog, onConfirm, onCancel, saving }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && !ref.current.open) {
      ref.current.showModal();
    }
  }, []);

  if (!dialog) return null;

  const isReceipt = dialog.actionType === "receipt";
  const isApprove = dialog.actionType === "approve_collection";
  const isDecline = dialog.actionType === "decline_collection";

  return (
    <dialog ref={ref} className="confirm-dialog" onClose={onCancel}>
      <header className="confirm-dialog__header">
        <span className="confirm-dialog__icon" aria-hidden="true">
          {isReceipt ? "📦" : isApprove ? "📝" : isDecline ? "⚠️" : "📤"}
        </span>
        <h2 className="confirm-dialog__title">
          {isReceipt ? "Confirm Item Receipt" : isApprove ? "Approve Collection Booking" : isDecline ? "Decline Collection Booking" : "Confirm Item Release"}
        </h2>
        <p className="confirm-dialog__subtitle">
          {isReceipt
            ? "This will mark the seller drop-off as received and notify the buyer."
            : isApprove
              ? "This will approve the buyer's requested slot so the item can be collected."
              : isDecline
                ? "This will remove the requested collection slot and ask the buyer to book again."
                : "This will complete the collection and close the transaction."}
        </p>
      </header>

      <section className="confirm-dialog__body">
        <ul className="confirm-dialog__info" role="list">
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">Item</span>
            <span className="confirm-dialog__info-value">{dialog.booking.itemName}</span>
          </li>
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">{isReceipt ? "Received from" : "Released to"}</span>
            <span className="confirm-dialog__info-value">{dialog.booking.personName}</span>
          </li>
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">Facility</span>
            <span className="confirm-dialog__info-value">{dialog.booking.location || "-"}</span>
          </li>
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">Transaction</span>
            <span className="confirm-dialog__info-value">{dialog.transaction.id}</span>
          </li>
        </ul>
      </section>

      <footer className="confirm-dialog__footer">
        <button className="btn-export" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn-primary" onClick={onConfirm} disabled={saving}>
          {saving ? "Saving..." : isReceipt ? "Confirm Receipt" : "Confirm Release"}
        </button>
      </footer>
    </dialog>
  );
}

function OverviewSection({ transactions, bookings }) {
  const active = transactions.filter((transaction) => !["item_released", "completed", "cancelled"].includes(transaction.status)).length;
  const awaitingDropoff = transactions.filter((transaction) => transaction.status === "awaiting_dropoff").length;
  const awaitingCollection = transactions.filter((transaction) => transaction.status === "awaiting_collection").length;
  const pendingCollectionApprovals = transactions.filter((transaction) => transaction.status === "collection_pending_approval").length;
  const completedToday = bookings.filter((booking) => booking.status === "completed").length;

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
          <li><StatCard icon="📋" iconColor="green" value={active} label="Open Transactions" subLabel="Need action from staff or students" /></li>
          <li><StatCard icon="📥" iconColor="amber" value={awaitingDropoff} label="Awaiting Drop-off" subLabel="Seller still needs to arrive" /></li>
          <li><StatCard icon="📝" iconColor="blue" value={pendingCollectionApprovals} label="Pending Collection Approval" subLabel="Buyer requests waiting for staff decision" /></li>
          <li><StatCard icon="🔔" iconColor="blue" value={awaitingCollection} label="Ready for Collection" subLabel="Approved buyers can now arrive" /></li>
          <li><StatCard icon="✅" iconColor="green" value={completedToday} label="Completed Bookings" subLabel="Drop-offs or collections already confirmed" /></li>
        </ul>
      </article>
    </section>
  );
}

function BookingsSection({
  type,
  bookings,
  transactions,
  onConfirmReceipt,
  onApproveCollection,
  onDeclineCollection,
  onConfirmRelease,
  onStatusChange,
  statusSavingIds,
}) {
  const [search, setSearch] = useState("");
  const label = type === "dropoff" ? "Drop-off" : "Collection";

  const filtered = bookings.filter((booking) => {
    if (booking.type !== type) return false;
    if (!search.trim()) return true;

    const haystack = [
      booking.personName,
      booking.itemName,
      booking.studentId,
      booking.transactionId,
      booking.location,
    ]
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
            <h3 className="panel__title">{label} Bookings</h3>
            <p className="panel__subtitle">
              {type === "dropoff"
                ? "Confirm when sellers hand items over to the facility."
                : "Confirm when buyers collect their items from the facility."}
            </p>
          </section>
        </header>

        <section className="bookings-controls">
          <label htmlFor={`${type}-search`} className="sr-only">Search bookings</label>
          <input
            id={`${type}-search`}
            type="search"
            className="bookings-search"
            placeholder="Search by name, item, booking or transaction..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </section>

        {filtered.length === 0 ? (
          <EmptyState
            icon="📭"
            title="No bookings found"
            description="Bookings will appear here once students schedule them."
          />
        ) : (
          <ul className="booking-list" role="list">
            {filtered.map((booking) => {
              const transaction = transactions.find((entry) => entry.id === booking.transactionId);
              return (
                <li key={booking.id}>
                  <BookingCard
                    booking={booking}
                    transaction={transaction}
                    onConfirmReceipt={onConfirmReceipt}
                    onApproveCollection={onApproveCollection}
                    onDeclineCollection={onDeclineCollection}
                    onConfirmRelease={onConfirmRelease}
                    onStatusChange={onStatusChange}
                    statusSaving={Boolean(statusSavingIds[booking.id])}
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

function TransactionsSection({ transactions, bookings, onTransactionStatusChange, statusSavingIds }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => transactions.filter((transaction) => {
    if (!search.trim()) return true;

    const haystack = [
      transaction.id,
      transaction.item,
      transaction.seller.name,
      transaction.buyer.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search.toLowerCase());
  }), [search, transactions]);

  return (
    <section className="view-section" aria-labelledby="transactions-heading">
      <h2 id="transactions-heading" className="sr-only">All Transactions</h2>

      <article className="panel">
        <header className="panel__header">
          <section>
            <h3 className="panel__title">All Transactions</h3>
            <p className="panel__subtitle">Track accepted offers through drop-off, custody, and collection.</p>
          </section>
          <p className="panel__count">{filtered.length} of {transactions.length} transactions</p>
        </header>

        <section className="bookings-controls">
          <label htmlFor="txn-search" className="sr-only">Search transactions</label>
          <input
            id="txn-search"
            type="search"
            className="bookings-search"
            placeholder="Search by transaction ID, item, buyer or seller..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
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
                  const dropoff = bookings.find((booking) => booking.id === transaction.dropoffId);
                  const collection = bookings.find((booking) => booking.id === transaction.collectionId);

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
                              onChange={(event) => onTransactionStatusChange(transaction.id, event.target.value)}
                              disabled={Boolean(statusSavingIds[transaction.id])}
                            >
                              {TRANSACTION_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {STATUS_META[status]?.label || status}
                                </option>
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

export default function TradeFacilityDashboard({ onSignOut, staffProfile }) {
  const [activeView, setActiveView] = useState("overview");
  const [transactions, setTransactions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusSavingIds, setStatusSavingIds] = useState({});
  const [toast, setToast] = useState({ msg: "", visible: false });
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast({ msg, visible: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg: "", visible: false }), 3200);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: transactionRows, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (transactionsError) {
        throw transactionsError;
      }

      const rows = transactionRows || [];
      const bookingIds = [...new Set(rows.flatMap((row) => [row.dropoff_id, row.collection_id]).filter(Boolean))];
      const profileIds = [...new Set(rows.flatMap((row) => [row.seller_id, row.buyer_id]).filter(Boolean))];

      const [{ data: bookingRows, error: bookingsError }, { data: profileRows, error: profilesError }] = await Promise.all([
        bookingIds.length
          ? supabase.from("bookings").select("*").in("id", bookingIds)
          : Promise.resolve({ data: [], error: null }),
        profileIds.length
          ? supabase.from("profiles").select("id, name, display_name, email").in("id", profileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (bookingsError) {
        throw bookingsError;
      }

      if (profilesError) {
        throw profilesError;
      }

      const profilesById = Object.fromEntries((profileRows || []).map((profile) => [profile.id, profile]));
      const bookingsById = Object.fromEntries((bookingRows || []).map((booking) => [booking.id, booking]));

      const mappedTransactions = rows.map((transaction) => ({
        ...transaction,
        dropoffId: transaction.dropoff_id,
        collectionId: transaction.collection_id,
        createdAt: transaction.created_at,
        seller: {
          name: profilesById[transaction.seller_id]?.display_name || profilesById[transaction.seller_id]?.name || transaction.seller_id,
          studentId: profilesById[transaction.seller_id]?.email || transaction.seller_id,
        },
        buyer: {
          name: profilesById[transaction.buyer_id]?.display_name || profilesById[transaction.buyer_id]?.name || transaction.buyer_id,
          studentId: profilesById[transaction.buyer_id]?.email || transaction.buyer_id,
        },
      }));

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

  const handleConfirmReceipt = useCallback((booking, transaction) => {
    setDialog({ actionType: "receipt", booking, transaction });
  }, []);

  const handleConfirmRelease = useCallback((booking, transaction) => {
    setDialog({ actionType: "release", booking, transaction });
  }, []);

  const handleApproveCollection = useCallback((booking, transaction) => {
    setDialog({ actionType: "approve_collection", booking, transaction });
  }, []);

  const handleDeclineCollection = useCallback((booking, transaction) => {
    setDialog({ actionType: "decline_collection", booking, transaction });
  }, []);

  const handleDialogCancel = useCallback(() => {
    if (!saving) {
      setDialog(null);
    }
  }, [saving]);

  const updateTransactionStatus = useCallback(async (transactionId, nextStatus) => {
    setStatusSavingIds((prev) => ({ ...prev, [transactionId]: true }));
    try {
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ status: nextStatus })
        .eq("id", transactionId);

      if (updateError) throw updateError;
      showToast(`Transaction status updated to ${STATUS_META[nextStatus]?.label || nextStatus}.`);
      await loadDashboard();
    } catch (err) {
      showToast(err.message || "Unable to update the transaction status.");
    } finally {
      setStatusSavingIds((prev) => {
        const next = { ...prev };
        delete next[transactionId];
        return next;
      });
    }
  }, [loadDashboard, showToast]);

  const updateBookingStatus = useCallback(async (booking, transaction, nextStatus) => {
    setStatusSavingIds((prev) => ({ ...prev, [booking.id]: true }));
    try {
      const updates = [];
      updates.push(
        supabase
          .from("bookings")
          .update({ status: nextStatus })
          .eq("id", booking.id)
      );

      if (transaction?.id) {
        updates.push(
          supabase
            .from("transactions")
            .update({
              status: mapBookingStatusToTransactionStatus(booking.type, nextStatus, transaction.status),
            })
            .eq("id", transaction.id)
        );
      }

      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      showToast(`Booking status updated to ${BOOKING_STATUS_META[nextStatus]?.label || nextStatus}.`);
      await loadDashboard();
    } catch (err) {
      showToast(err.message || "Unable to update the booking status.");
    } finally {
      setStatusSavingIds((prev) => {
        const next = { ...prev };
        delete next[booking.id];
        return next;
      });
    }
  }, [loadDashboard, showToast]);

  const handleDialogConfirm = useCallback(async () => {
    if (!dialog) return;

    const { actionType, booking, transaction } = dialog;
    setSaving(true);

    try {
      if (actionType === "receipt") {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ status: "item_received" })
          .eq("id", transaction.id);

        if (updateError) {
          throw updateError;
        }

        if (staffProfile?.id) {
          await insertMessage({
            sender_id: staffProfile.id,
            receiver_id: transaction.buyer_id,
            content: `Your item "${transaction.item}" has been checked in at ${booking.location || "the trade facility"}. You can now book your collection slot in My Bookings.`,
          });
        }

        showToast(`Item received from ${booking.personName}. Buyer notified to book collection.`);
      } else if (actionType === "approve_collection") {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ status: "awaiting_collection" })
          .eq("id", transaction.id);

        if (updateError) {
          throw updateError;
        }

        if (staffProfile?.id) {
          await insertMessage({
            sender_id: staffProfile.id,
            receiver_id: transaction.buyer_id,
            content: `Your collection booking for "${transaction.item}" at ${booking.location || "the trade facility"} on ${formatDate(booking.scheduledDate)} at ${booking.scheduledTime} has been approved.`,
          });
        }

        showToast(`Collection booking approved for ${booking.personName}.`);
      } else if (actionType === "decline_collection") {
        const [{ error: deleteBookingError }, { error: updateError }] = await Promise.all([
          supabase.from("bookings").delete().eq("id", booking.id),
          supabase.from("transactions").update({ status: "item_received", collection_id: null }).eq("id", transaction.id),
        ]);

        if (deleteBookingError) {
          throw deleteBookingError;
        }

        if (updateError) {
          throw updateError;
        }

        if (staffProfile?.id) {
          await insertMessage({
            sender_id: staffProfile.id,
            receiver_id: transaction.buyer_id,
            content: `Your collection booking for "${transaction.item}" was declined. Please choose a different slot in My Bookings.`,
          });
        }

        showToast(`Collection booking declined for ${booking.personName}.`);
      } else {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ status: "item_released" })
          .eq("id", transaction.id);

        if (updateError) {
          throw updateError;
        }

        showToast(`Item released to ${booking.personName}. Transaction marked as released.`);
      }

      setDialog(null);
      await loadDashboard();
    } catch (err) {
      showToast(err.message || "Unable to update the transaction.");
    } finally {
      setSaving(false);
    }
  }, [dialog, loadDashboard, showToast, staffProfile?.id]);

  const pendingDropoffs = bookings.filter((booking) => booking.type === "dropoff" && booking.status === "scheduled").length;
  const pendingCollections = bookings.filter((booking) => booking.type === "collection" && booking.status === "scheduled").length;
  const dateLabel = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const viewTitles = {
    overview: "Dashboard Overview",
    dropoffs: "Drop-off Bookings",
    collections: "Collection Bookings",
    transactions: "All Transactions",
  };

  return (
    <section className="staff-dashboard-wrapper">
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
              const badge = item.key === "dropoffs" ? pendingDropoffs : item.key === "collections" ? pendingCollections : 0;
              return (
                <li key={item.key}>
                  <button
                    className={`sidebar__nav-btn ${activeView === item.key ? "sidebar__nav-btn--active" : ""}`}
                    onClick={() => setActiveView(item.key)}
                    aria-current={activeView === item.key ? "page" : undefined}
                  >
                    <span className="sidebar__nav-icon" aria-hidden="true">{item.icon}</span>
                    {item.label}
                    {badge > 0 ? <span className="sidebar__nav-badge" aria-label={`${badge} pending`}>{badge}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <footer className="sidebar__footer">
          <span className="staff-avatar" aria-hidden="true">{initials(staffProfile?.display_name || staffProfile?.name || "Staff")}</span>
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

        {loading ? <div className="panel">Loading facility activity...</div> : null}
        {!loading && error ? <div className="panel">{error}</div> : null}
        {!loading && !error && activeView === "overview" ? <OverviewSection transactions={transactions} bookings={bookings} /> : null}
        {!loading && !error && activeView === "dropoffs" ? (
          <BookingsSection
            type="dropoff"
            bookings={bookings}
            transactions={transactions}
            onConfirmReceipt={handleConfirmReceipt}
            onApproveCollection={handleApproveCollection}
            onDeclineCollection={handleDeclineCollection}
            onConfirmRelease={handleConfirmRelease}
            onStatusChange={updateBookingStatus}
            statusSavingIds={statusSavingIds}
          />
        ) : null}
        {!loading && !error && activeView === "collections" ? (
          <BookingsSection
            type="collection"
            bookings={bookings}
            transactions={transactions}
            onConfirmReceipt={handleConfirmReceipt}
            onApproveCollection={handleApproveCollection}
            onDeclineCollection={handleDeclineCollection}
            onConfirmRelease={handleConfirmRelease}
            onStatusChange={updateBookingStatus}
            statusSavingIds={statusSavingIds}
          />
        ) : null}
        {!loading && !error && activeView === "transactions" ? (
          <TransactionsSection
            transactions={transactions}
            bookings={bookings}
            onTransactionStatusChange={updateTransactionStatus}
            statusSavingIds={statusSavingIds}
          />
        ) : null}
      </main>

      {dialog ? (
        <ConfirmDialog
          dialog={dialog}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
          saving={saving}
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
