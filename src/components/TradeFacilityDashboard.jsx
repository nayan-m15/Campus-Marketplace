import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabaseClient"; 
import "../styles/TradeFacilityDashboard.css";

// ── HELPERS ────────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split("T")[0];

const STATUS_META = {
  awaiting_dropoff:    { label: "Awaiting Drop-off",    cls: "status--awaiting-dropoff",    icon: "⏳" },
  item_received:       { label: "Item Received",         cls: "status--item-received",       icon: "📦" },
  awaiting_collection: { label: "Awaiting Collection",   cls: "status--awaiting-collection", icon: "🔔" },
  item_released:       { label: "Item Released",         cls: "status--item-released",       icon: "✅" },
  completed:           { label: "Completed",             cls: "status--completed",           icon: "🏁" },
  cancelled:           { label: "Cancelled",             cls: "status--cancelled",           icon: "✗"  },
};

const BOOKING_STATUS_META = {
  pending:    { label: "Pending",     cls: "bstatus--pending"     },
  accepted:   { label: "Scheduled",   cls: "bstatus--scheduled"   },
  completed:  { label: "Completed",   cls: "bstatus--completed"   },
  no_show:    { label: "No-Show",     cls: "bstatus--no-show"     },
  cancelled:  { label: "Cancelled",   cls: "bstatus--cancelled"   },
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = typeof dateStr === "string" ? dateStr.slice(0, 10) : dateStr;
  if (date === TODAY) return "Today";
  const diff = Math.round((new Date(date) - new Date(TODAY)) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Date(date + "T00:00:00").toLocaleDateString("en-ZA", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatTime(timestamp) {
  if (!timestamp) return "—";
  return timestamp.slice(11, 16); // "HH:MM"
}

function formatDateFromTimestamp(timestamp) {
  if (!timestamp) return "—";
  return formatDate(timestamp.slice(0, 10));
}

function initials(name = "") {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2) || "?";
}

// ── SUB-COMPONENTS (unchanged from your original) ─────────────────────────────

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

function StatCard({ icon, iconColor, value, label, subLabel }) {
  return (
    <article className="stat-card">
      <header className="stat-card__top">
        <span className={`stat-card__icon stat-card__icon--${iconColor}`} aria-hidden="true">{icon}</span>
      </header>
      <p className="stat-card__value">{value}</p>
      <footer className="stat-card__footer">
        <p className="stat-card__label">{label}</p>
        {subLabel && <p className="stat-card__sublabel">{subLabel}</p>}
      </footer>
    </article>
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

function LoadingState() {
  return (
    <section className="empty-state">
      <p className="empty-state__title">Loading…</p>
    </section>
  );
}

// ── PENDING BOOKING CARD ───────────────────────────────────────────────────────

function PendingBookingCard({ booking, onAccept, onDecline }) {
  const isDropoff = booking.type === "dropoff";
  return (
    <article className="booking-card booking-card--pending">
      <header className="booking-card__header">
        <section className="booking-card__header-left">
          <Avatar name={booking.user_display_name || "?"} />
          <section className="booking-card__person-info">
            <p className="booking-card__person-name">{booking.user_display_name || "Unknown user"}</p>
            <p className="booking-card__person-meta">{booking.user_email}</p>
          </section>
        </section>
        <section className="booking-card__header-right">
          <span className={`booking-type-tag booking-type-tag--${booking.type}`}>
            {isDropoff ? "📥 Drop-off" : "📤 Collection"}
          </span>
          <BookingStatusBadge status="pending" />
        </section>
      </header>

      <section className="booking-card__body">
        <ul className="booking-card__details" role="list">
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Item</span>
            <span className="booking-card__detail-value">{booking.transaction_item}</span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Requested</span>
            <span className="booking-card__detail-value">
              {formatDateFromTimestamp(booking.scheduled_time)} at {formatTime(booking.scheduled_time)}
            </span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Branch</span>
            <span className="booking-card__detail-value">{booking.facility_name}</span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Transaction</span>
            <span className="booking-card__detail-value booking-card__txn-id">{booking.transaction_id}</span>
          </li>
          {booking.notes && (
            <li className="booking-card__detail booking-card__detail--notes">
              <span className="booking-card__detail-label">Notes</span>
              <span className="booking-card__detail-value booking-card__notes">{booking.notes}</span>
            </li>
          )}
        </ul>
      </section>

      <footer className="booking-card__footer">
        <menu className="booking-card__actions" role="list">
          <li>
            <button
              className="btn-action btn-action--noshow"
              onClick={() => onDecline(booking)}
            >
              Decline
            </button>
          </li>
          <li>
            <button
              className="btn-action btn-action--receipt"
              onClick={() => onAccept(booking)}
            >
              ✓ Accept Slot
            </button>
          </li>
        </menu>
      </footer>
    </article>
  );
}

// ── BOOKING CARD (accepted/completed) ─────────────────────────────────────────

function BookingCard({ booking, onConfirmReceipt, onConfirmRelease, onMarkNoShow }) {
  const isDropoff    = booking.type === "dropoff";
  const isCollection = booking.type === "collection";
  const isAccepted   = booking.status === "accepted";

  const canConfirmReceipt =
    isDropoff && isAccepted &&
    booking.transaction_status === "awaiting_dropoff";
  const canConfirmRelease =
    isCollection && isAccepted &&
    ["awaiting_collection", "item_received"].includes(booking.transaction_status);
  const canMarkNoShow = isAccepted;

  const scheduledDate = booking.scheduled_time?.slice(0, 10);
  const isToday = scheduledDate === TODAY;

  return (
    <article className={`booking-card ${isToday ? "booking-card--today" : ""}`}>
      <header className="booking-card__header">
        <section className="booking-card__header-left">
          <Avatar name={booking.user_display_name || "?"} />
          <section className="booking-card__person-info">
            <p className="booking-card__person-name">{booking.user_display_name || "—"}</p>
            <p className="booking-card__person-meta">{booking.user_email}</p>
          </section>
        </section>
        <section className="booking-card__header-right">
          <span className={`booking-type-tag booking-type-tag--${booking.type}`}>
            {isDropoff ? "📥 Drop-off" : "📤 Collection"}
          </span>
          <BookingStatusBadge status={booking.status} />
        </section>
      </header>

      <section className="booking-card__body">
        <ul className="booking-card__details" role="list">
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Item</span>
            <span className="booking-card__detail-value">{booking.transaction_item}</span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Scheduled</span>
            <span className="booking-card__detail-value">
              {formatDateFromTimestamp(booking.scheduled_time)} at {formatTime(booking.scheduled_time)}
            </span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Branch</span>
            <span className="booking-card__detail-value">{booking.facility_name}</span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Transaction</span>
            <span className="booking-card__detail-value booking-card__txn-id">{booking.transaction_id}</span>
          </li>
          {booking.transaction_status && (
            <li className="booking-card__detail">
              <span className="booking-card__detail-label">Txn Status</span>
              <StatusBadge status={booking.transaction_status} />
            </li>
          )}
          {booking.notes && (
            <li className="booking-card__detail booking-card__detail--notes">
              <span className="booking-card__detail-label">Notes</span>
              <span className="booking-card__detail-value booking-card__notes">{booking.notes}</span>
            </li>
          )}
        </ul>
      </section>

      {isAccepted && (
        <footer className="booking-card__footer">
          <menu className="booking-card__actions" role="list">
            {canConfirmReceipt && (
              <li>
                <button className="btn-action btn-action--receipt" onClick={() => onConfirmReceipt(booking)}>
                  <span aria-hidden="true">✓</span> Confirm Receipt
                </button>
              </li>
            )}
            {canConfirmRelease && (
              <li>
                <button className="btn-action btn-action--release" onClick={() => onConfirmRelease(booking)}>
                  <span aria-hidden="true">↑</span> Confirm Release
                </button>
              </li>
            )}
            {canMarkNoShow && (
              <li>
                <button className="btn-action btn-action--noshow" onClick={() => onMarkNoShow(booking)}>
                  Mark No-Show
                </button>
              </li>
            )}
          </menu>
        </footer>
      )}
    </article>
  );
}

// ── CONFIRM DIALOG ─────────────────────────────────────────────────────────────

function ConfirmDialog({ dialog, onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  if (!dialog) return null;

  const isReceipt = dialog.actionType === "receipt";
  return (
    <dialog ref={ref} className="confirm-dialog" onClose={onCancel}>
      <header className="confirm-dialog__header">
        <span className="confirm-dialog__icon" aria-hidden="true">{isReceipt ? "📦" : "📤"}</span>
        <h2 className="confirm-dialog__title">
          {isReceipt ? "Confirm Item Receipt" : "Confirm Item Release"}
        </h2>
        <p className="confirm-dialog__subtitle">
          {isReceipt
            ? "Verify you have physically received the item from the seller."
            : "Verify you are releasing the item to the correct buyer."}
        </p>
      </header>
      <section className="confirm-dialog__body">
        <ul className="confirm-dialog__info" role="list">
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">Item</span>
            <span className="confirm-dialog__info-value">{dialog.booking.transaction_item}</span>
          </li>
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">
              {isReceipt ? "Received from" : "Releasing to"}
            </span>
            <span className="confirm-dialog__info-value">
              {dialog.booking.user_display_name}
              <span className="confirm-dialog__info-id"> ({dialog.booking.user_email})</span>
            </span>
          </li>
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">Transaction</span>
            <span className="confirm-dialog__info-value">{dialog.booking.transaction_id}</span>
          </li>
          {dialog.booking.transaction_price && (
            <li className="confirm-dialog__info-row">
              <span className="confirm-dialog__info-label">Value</span>
              <span className="confirm-dialog__info-value">
                R {Number(dialog.booking.transaction_price).toLocaleString("en-ZA")}
              </span>
            </li>
          )}
        </ul>
        <p className="confirm-dialog__warning">
          <span aria-hidden="true">⚠️</span>
          {isReceipt
            ? " This action confirms the item is now in facility custody. This cannot be undone."
            : " This action confirms the transaction is complete and the item has been released. This cannot be undone."}
        </p>
      </section>
      <footer className="confirm-dialog__footer">
        <button className="btn-export" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={onConfirm}>
          {isReceipt ? "✓ Confirm Receipt" : "✓ Confirm Release"}
        </button>
      </footer>
    </dialog>
  );
}

// ── PENDING REQUESTS SECTION ───────────────────────────────────────────────────

function PendingSection({ bookings, loading, onAccept, onDecline }) {
  return (
    <section className="view-section" aria-labelledby="pending-heading">
      <h2 id="pending-heading" className="sr-only">Pending Booking Requests</h2>
      <article className="panel">
        <header className="panel__header">
          <section>
            <h3 className="panel__title">Pending Requests</h3>
            <p className="panel__subtitle">Booking slots requested by users — accept or decline</p>
          </section>
          {bookings.length > 0 && (
            <span className="schedule-count">{bookings.length} pending</span>
          )}
        </header>
        {loading ? (
          <LoadingState />
        ) : bookings.length === 0 ? (
          <EmptyState icon="✓" title="No pending requests" description="All booking requests have been handled." />
        ) : (
          <ul className="booking-list" role="list">
            {bookings.map((b) => (
              <li key={b.id}>
                <PendingBookingCard booking={b} onAccept={onAccept} onDecline={onDecline} />
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}

// ── OVERVIEW SECTION ───────────────────────────────────────────────────────────

function OverviewSection({ bookings, loading }) {
  const todayDropoffs = bookings.filter(
    (b) => b.type === "dropoff" && b.status === "accepted" && b.scheduled_time?.slice(0, 10) === TODAY
  );
  const todayCollections = bookings.filter(
    (b) => b.type === "collection" && b.status === "accepted" && b.scheduled_time?.slice(0, 10) === TODAY
  );
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const completedToday = bookings.filter(
    (b) => b.status === "completed" && b.scheduled_time?.slice(0, 10) === TODAY
  ).length;

  const recentActivity = [...bookings]
    .filter((b) => b.status !== "accepted" && b.status !== "pending")
    .sort((a, b) => (b.scheduled_time > a.scheduled_time ? 1 : -1))
    .slice(0, 5);

  return (
    <section className="view-section" aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="sr-only">Overview</h2>

      <ul className="stats-grid" role="list">
        <li><StatCard icon="⏳" iconColor="orange" value={pendingCount}              label="Pending Requests"    subLabel="Awaiting acceptance" /></li>
        <li><StatCard icon="📥" iconColor="blue"   value={todayDropoffs.length}      label="Drop-offs Today"     subLabel="Accepted slots" /></li>
        <li><StatCard icon="📤" iconColor="purple" value={todayCollections.length}   label="Collections Today"   subLabel="Accepted slots" /></li>
        <li><StatCard icon="🏁" iconColor="green"  value={completedToday}            label="Completed Today"     subLabel="Handled today" /></li>
      </ul>

      <section className="overview-grid">
        <article className="panel overview-schedule-panel">
          <header className="panel__header">
            <section>
              <h3 className="panel__title">Today's Drop-offs</h3>
              <p className="panel__subtitle">{formatDate(TODAY)}</p>
            </section>
            <span className="schedule-count">{todayDropoffs.length} scheduled</span>
          </header>
          {loading ? <LoadingState /> : todayDropoffs.length === 0 ? (
            <EmptyState icon="📭" title="No drop-offs today" description="No sellers scheduled for today." />
          ) : (
            <ul className="schedule-list" role="list">
              {todayDropoffs.map((b) => (
                <li key={b.id} className="schedule-item">
                  <span className="schedule-item__time">{formatTime(b.scheduled_time)}</span>
                  <section className="schedule-item__info">
                    <p className="schedule-item__name">{b.user_display_name}</p>
                    <p className="schedule-item__item">{b.transaction_item}</p>
                  </section>
                  <BookingStatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel overview-schedule-panel">
          <header className="panel__header">
            <section>
              <h3 className="panel__title">Today's Collections</h3>
              <p className="panel__subtitle">{formatDate(TODAY)}</p>
            </section>
            <span className="schedule-count">{todayCollections.length} scheduled</span>
          </header>
          {loading ? <LoadingState /> : todayCollections.length === 0 ? (
            <EmptyState icon="📭" title="No collections today" description="No buyers scheduled for today." />
          ) : (
            <ul className="schedule-list" role="list">
              {todayCollections.map((b) => (
                <li key={b.id} className="schedule-item">
                  <span className="schedule-item__time">{formatTime(b.scheduled_time)}</span>
                  <section className="schedule-item__info">
                    <p className="schedule-item__name">{b.user_display_name}</p>
                    <p className="schedule-item__item">{b.transaction_item}</p>
                  </section>
                  <StatusBadge status={b.transaction_status} />
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <article className="panel">
        <header className="panel__header">
          <section>
            <h3 className="panel__title">Recent Activity</h3>
            <p className="panel__subtitle">Latest completed or no-show bookings</p>
          </section>
        </header>
        {loading ? <LoadingState /> : recentActivity.length === 0 ? (
          <EmptyState icon="📋" title="No recent activity" description="Completed bookings will appear here." />
        ) : (
          <ul className="activity-feed" role="list">
            {recentActivity.map((b) => (
              <li key={b.id} className="activity-item">
                <span className={`activity-item__dot activity-item__dot--${b.type}`} aria-hidden="true" />
                <section className="activity-item__content">
                  <p className="activity-item__text">
                    <strong>{b.user_display_name}</strong>{" "}
                    {b.status === "completed"
                      ? b.type === "dropoff" ? "dropped off" : "collected"
                      : b.status === "no_show" ? "did not show for"
                      : b.status === "cancelled" ? "cancelled booking for"
                      : "updated booking for"}{" "}
                    <em>{b.transaction_item}</em>
                  </p>
                  <p className="activity-item__meta">
                    {b.transaction_id} · {formatDateFromTimestamp(b.scheduled_time)} at {formatTime(b.scheduled_time)}
                  </p>
                </section>
                <BookingStatusBadge status={b.status} />
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}

// ── BOOKINGS SECTION ───────────────────────────────────────────────────────────

function BookingsSection({ type, bookings, loading, onConfirmReceipt, onConfirmRelease, onMarkNoShow }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const isDropoff  = type === "dropoff";
  const label      = isDropoff ? "Drop-off" : "Collection";
  const typeBookings = bookings.filter((b) => b.type === type && b.status !== "pending");

  const filtered = typeBookings.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      b.user_display_name?.toLowerCase().includes(q) ||
      b.transaction_item?.toLowerCase().includes(q) ||
      b.user_email?.toLowerCase().includes(q) ||
      b.transaction_id?.toLowerCase().includes(q);

    const scheduledDate = b.scheduled_time?.slice(0, 10);
    const matchFilter =
      filter === "all"       ||
      (filter === "today"    && scheduledDate === TODAY && b.status === "accepted") ||
      (filter === "upcoming" && scheduledDate > TODAY   && b.status === "accepted") ||
      (filter === "past"     && scheduledDate < TODAY   && b.status === "accepted") ||
      (filter === "completed"&& b.status === "completed") ||
      (filter === "no_show"  && b.status === "no_show");

    return matchSearch && matchFilter;
  });

  const counts = {
    all:       typeBookings.length,
    today:     typeBookings.filter((b) => b.scheduled_time?.slice(0, 10) === TODAY && b.status === "accepted").length,
    upcoming:  typeBookings.filter((b) => b.scheduled_time?.slice(0, 10) > TODAY && b.status === "accepted").length,
    completed: typeBookings.filter((b) => b.status === "completed").length,
    no_show:   typeBookings.filter((b) => b.status === "no_show").length,
  };

  const TABS = [
    { key: "all",       label: "All"       },
    { key: "today",     label: "Today"     },
    { key: "upcoming",  label: "Upcoming"  },
    { key: "completed", label: "Completed" },
    { key: "no_show",   label: "No-Show"   },
  ];

  return (
    <section className="view-section" aria-labelledby={`${type}-heading`}>
      <h2 id={`${type}-heading`} className="sr-only">{label} Bookings</h2>
      <article className="panel">
        <header className="panel__header">
          <section>
            <h3 className="panel__title">{label} Bookings</h3>
            <p className="panel__subtitle">
              {isDropoff
                ? "Manage seller drop-offs and confirm item receipt"
                : "Manage buyer collections and confirm item release"}
            </p>
          </section>
        </header>

        <section className="bookings-controls">
          <label htmlFor={`${type}-search`} className="sr-only">Search bookings</label>
          <input
            id={`${type}-search`}
            type="search"
            className="bookings-search"
            placeholder="Search by name, item, email or transaction…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </section>

        <nav className="filter-tabs" aria-label={`Filter ${label} bookings`}>
          <ul className="filter-tabs__list" role="list">
            {TABS.map((tab) => (
              <li key={tab.key}>
                <button
                  className={`filter-tab ${filter === tab.key ? "filter-tab--active" : ""}`}
                  onClick={() => setFilter(tab.key)}
                  aria-pressed={filter === tab.key}
                >
                  {tab.label}
                  {counts[tab.key] > 0 && (
                    <span className="filter-tab__count">{counts[tab.key]}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {loading ? <LoadingState /> : filtered.length === 0 ? (
          <EmptyState icon="🔍" title="No bookings found" description="Try adjusting your search or filter." />
        ) : (
          <ul className="booking-list" role="list">
            {filtered.map((booking) => (
              <li key={booking.id}>
                <BookingCard
                  booking={booking}
                  onConfirmReceipt={onConfirmReceipt}
                  onConfirmRelease={onConfirmRelease}
                  onMarkNoShow={onMarkNoShow}
                />
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}

// ── MAIN DASHBOARD ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { key: "overview",     label: "Overview",             icon: "🏠" },
  { key: "pending",      label: "Pending Requests",     icon: "⏳" },
  { key: "dropoffs",     label: "Drop-off Bookings",    icon: "📥" },
  { key: "collections",  label: "Collection Bookings",  icon: "📤" },
];

export default function TradeFacilityDashboard({ onSignOut, staffProfile }) {
  const [activeView, setActiveView]   = useState("overview");
  const [bookings,   setBookings]     = useState([]);
  const [loading,    setLoading]      = useState(true);
  const [dialog,     setDialog]       = useState(null);
  const [toast,      setToast]        = useState({ msg: "", visible: false });
  const toastTimer = useRef(null);

  // ── Fetch all bookings from the view ──
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings_detailed")
      .select("*")
      .order("scheduled_time", { ascending: true });
    if (data) setBookings(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // ── Realtime subscription ──
  useEffect(() => {
    const channel = supabase
      .channel("bookings-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        fetchBookings();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchBookings]);

  

  // ── Toast ──
  const showToast = useCallback((msg) => {
    setToast({ msg, visible: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg: "", visible: false }), 3200);
  }, []);

  // ── Accept pending booking ──
  const handleAccept = useCallback(async (booking) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "accepted" })
      .eq("id", booking.id);
    if (!error) {
      showToast(`✓ Booking accepted for ${booking.user_display_name}`);
      fetchBookings();
    }
  }, [fetchBookings, showToast]);

  // ── Decline pending booking ──
  const handleDecline = useCallback(async (booking) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);
    if (!error) {
      showToast(`Booking declined for ${booking.user_display_name}`);
      fetchBookings();
    }
  }, [fetchBookings, showToast]);

  // ── Confirm receipt ──
  const handleConfirmReceipt = useCallback((booking) => {
    setDialog({ actionType: "receipt", booking });
  }, []);

  // ── Confirm release ──
  const handleConfirmRelease = useCallback((booking) => {
    setDialog({ actionType: "release", booking });
  }, []);

  // ── Mark no-show ──
  const handleMarkNoShow = useCallback(async (booking) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "no_show" })
      .eq("id", booking.id);
    if (!error) {
      showToast(`No-show recorded for ${booking.user_display_name}`);
      fetchBookings();
    }
  }, [fetchBookings, showToast]);

  // ── Dialog confirm ──
  const handleDialogConfirm = useCallback(async () => {
    if (!dialog) return;
    const { actionType, booking } = dialog;

    const bookingUpdate = { status: "completed" };
    const newTxnStatus  = actionType === "receipt" ? "item_received" : "completed";

    const [{ error: bErr }, { error: tErr }] = await Promise.all([
      supabase.from("bookings").update(bookingUpdate).eq("id", booking.id),
      supabase.from("transactions").update({ status: newTxnStatus }).eq("id", booking.transaction_id),
    ]);

    if (!bErr && !tErr) {
      showToast(
        actionType === "receipt"
          ? `✓ Item received from ${booking.user_display_name} — ${booking.transaction_item}`
          : `✓ Item released to ${booking.user_display_name} — transaction complete`
      );
      fetchBookings();
    }
    setDialog(null);
  }, [dialog, fetchBookings, showToast]);

  const handleDialogCancel = useCallback(() => setDialog(null), []);

  // ── Derived counts for sidebar badges ──
  const pendingCount       = bookings.filter((b) => b.status === "pending").length;
  const todayDropoffs      = bookings.filter((b) => b.type === "dropoff"    && b.status === "accepted" && b.scheduled_time?.slice(0, 10) === TODAY).length;
  const todayCollections   = bookings.filter((b) => b.type === "collection" && b.status === "accepted" && b.scheduled_time?.slice(0, 10) === TODAY).length;

  const pendingBookings  = bookings.filter((b) => b.status === "pending");
  const acceptedBookings = bookings.filter((b) => b.status !== "pending");

  const dateLabel = new Date(TODAY + "T00:00:00").toLocaleDateString("en-ZA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const VIEW_TITLES = {
    overview:    "Dashboard Overview",
    pending:     "Pending Requests",
    dropoffs:    "Drop-off Bookings",
    collections: "Collection Bookings",
  };

  return (
    <section className="staff-dashboard-wrapper">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <header className="sidebar__brand">
          <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="UX Logo" className="sidebar__logo" />
          <section className="sidebar__brand-text">
            <p className="sidebar__app-name">Unexus</p>
            <p className="sidebar__role">Trade Facility</p>
          </section>
        </header>

        <nav aria-label="Dashboard navigation">
          <ul className="sidebar__nav" role="list">
            {NAV_ITEMS.map((item) => {
              const badge =
                item.key === "pending"      ? pendingCount :
                item.key === "dropoffs"     ? todayDropoffs :
                item.key === "collections"  ? todayCollections : 0;
              return (
                <li key={item.key}>
                  <button
                    className={`sidebar__nav-btn ${activeView === item.key ? "sidebar__nav-btn--active" : ""}`}
                    onClick={() => setActiveView(item.key)}
                    aria-current={activeView === item.key ? "page" : undefined}
                  >
                    <span className="sidebar__nav-icon" aria-hidden="true">{item.icon}</span>
                    {item.label}
                    {badge > 0 && (
                      <span className="sidebar__nav-badge" aria-label={`${badge} items`}>{badge}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <footer className="sidebar__footer">
          <span className="staff-avatar" aria-hidden="true">
            {initials(staffProfile?.display_name || "Staff")}
          </span>
          <section className="staff-info">
            <p className="staff-name">{staffProfile?.display_name || "Staff"}</p>
            <p className="staff-email">{staffProfile?.email || ""}</p>
          </section>
          {onSignOut && (
            <button className="sidebar__signout-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
              ⏻
            </button>
          )}
        </footer>
      </aside>

      {/* ── Main Content ── */}
      <main className="dashboard-main" id="main-content">
        <header className="dashboard-topbar">
          <section className="topbar-left">
            <h1 className="topbar-title">{VIEW_TITLES[activeView]}</h1>
            <p className="topbar-date">{dateLabel}</p>
          </section>
          <section className="topbar-right">
            <span className="facility-open-badge">
              <span className="facility-open-dot" aria-hidden="true" />
              Facility Open
            </span>
          </section>
        </header>

        {activeView === "overview" && (
          <OverviewSection bookings={bookings} loading={loading} />
        )}
        {activeView === "pending" && (
          <PendingSection
            bookings={pendingBookings}
            loading={loading}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        )}
        {activeView === "dropoffs" && (
          <BookingsSection
            type="dropoff"
            bookings={acceptedBookings}
            loading={loading}
            onConfirmReceipt={handleConfirmReceipt}
            onConfirmRelease={handleConfirmRelease}
            onMarkNoShow={handleMarkNoShow}
          />
        )}
        {activeView === "collections" && (
          <BookingsSection
            type="collection"
            bookings={acceptedBookings}
            loading={loading}
            onConfirmReceipt={handleConfirmReceipt}
            onConfirmRelease={handleConfirmRelease}
            onMarkNoShow={handleMarkNoShow}
          />
        )}
      </main>

      {/* ── Confirmation Dialog ── */}
      {dialog && (
        <ConfirmDialog
          dialog={dialog}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
        />
      )}

      {/* ── Toast ── */}
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
