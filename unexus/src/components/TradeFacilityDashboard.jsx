import { useState, useEffect, useRef, useCallback } from "react";
import "../styles/TradeFacilityDashboard.css";

// ── MOCK DATA

const INITIAL_TRANSACTIONS = [
  {
    id: "TXN-001",
    item: "MacBook Pro M1 (2021)",
    seller: { name: "Liam Dubé", studentId: "STU-2341" },
    buyer: { name: "Amara Osei", studentId: "STU-5892" },
    price: 12500,
    status: "awaiting_dropoff",
    dropoffId: "BK-001",
    collectionId: "BK-007",
    createdAt: "2026-04-05",
  },
  {
    id: "TXN-002",
    item: "Calculus Textbook (Stewart, 9th Ed)",
    seller: { name: "Priya Nair", studentId: "STU-1182" },
    buyer: { name: "Kofi Mensah", studentId: "STU-3047" },
    price: 450,
    status: "item_received",
    dropoffId: "BK-002",
    collectionId: "BK-008",
    createdAt: "2026-04-06",
  },
  {
    id: "TXN-003",
    item: "Mechanical Keyboard (Keychron K2)",
    seller: { name: "Sipho Zulu", studentId: "STU-4421" },
    buyer: { name: "Fatima Al-Rashid", studentId: "STU-6631" },
    price: 1800,
    status: "awaiting_collection",
    dropoffId: "BK-003",
    collectionId: "BK-009",
    createdAt: "2026-04-06",
  },
  {
    id: "TXN-004",
    item: "Chemistry Lab Coat (Size L)",
    seller: { name: "Tshepo Mokoena", studentId: "STU-7712" },
    buyer: { name: "Elena Popescu", studentId: "STU-2298" },
    price: 180,
    status: "completed",
    dropoffId: "BK-004",
    collectionId: "BK-010",
    createdAt: "2026-04-04",
  },
  {
    id: "TXN-005",
    item: '27" LG UltraWide Monitor',
    seller: { name: "Daniel Eze", studentId: "STU-8834" },
    buyer: { name: "Nizhoni Runningwater", studentId: "STU-5501" },
    price: 3200,
    status: "awaiting_dropoff",
    dropoffId: "BK-005",
    collectionId: null,
    createdAt: "2026-04-08",
  },
  {
    id: "TXN-006",
    item: "Scientific Calculator (Casio fx-991EX)",
    seller: { name: "Amara Osei", studentId: "STU-5892" },
    buyer: { name: "Sipho Zulu", studentId: "STU-4421" },
    price: 350,
    status: "item_released",
    dropoffId: "BK-006",
    collectionId: "BK-011",
    createdAt: "2026-04-03",
  },
];

const TODAY = "2026-04-09";

const INITIAL_BOOKINGS = [
  // Drop-offs
  {
    id: "BK-001", type: "dropoff", transactionId: "TXN-001",
    personName: "Liam Dubé", studentId: "STU-2341", role: "seller",
    scheduledDate: TODAY, scheduledTime: "10:00",
    status: "scheduled", itemName: "MacBook Pro M1 (2021)",
    notes: "Original box and charger included.",
  },
  {
    id: "BK-002", type: "dropoff", transactionId: "TXN-002",
    personName: "Priya Nair", studentId: "STU-1182", role: "seller",
    scheduledDate: "2026-04-08", scheduledTime: "14:30",
    status: "completed", itemName: "Calculus Textbook (Stewart, 9th Ed)",
    notes: "",
  },
  {
    id: "BK-003", type: "dropoff", transactionId: "TXN-003",
    personName: "Sipho Zulu", studentId: "STU-4421", role: "seller",
    scheduledDate: "2026-04-08", scheduledTime: "09:00",
    status: "completed", itemName: "Mechanical Keyboard (Keychron K2)",
    notes: "USB-C cable included.",
  },
  {
    id: "BK-004", type: "dropoff", transactionId: "TXN-004",
    personName: "Tshepo Mokoena", studentId: "STU-7712", role: "seller",
    scheduledDate: "2026-04-07", scheduledTime: "11:00",
    status: "completed", itemName: "Chemistry Lab Coat (Size L)",
    notes: "",
  },
  {
    id: "BK-005", type: "dropoff", transactionId: "TXN-005",
    personName: "Daniel Eze", studentId: "STU-8834", role: "seller",
    scheduledDate: "2026-04-10", scheduledTime: "13:00",
    status: "scheduled", itemName: '27" LG UltraWide Monitor',
    notes: "HDMI cable and stand included. Fragile — large item.",
  },
  {
    id: "BK-006", type: "dropoff", transactionId: "TXN-006",
    personName: "Amara Osei", studentId: "STU-5892", role: "seller",
    scheduledDate: "2026-04-07", scheduledTime: "15:00",
    status: "completed", itemName: "Scientific Calculator (Casio fx-991EX)",
    notes: "",
  },
  // Collections
  {
    id: "BK-007", type: "collection", transactionId: "TXN-001",
    personName: "Amara Osei", studentId: "STU-5892", role: "buyer",
    scheduledDate: "2026-04-11", scheduledTime: "10:00",
    status: "scheduled", itemName: "MacBook Pro M1 (2021)",
    notes: "",
  },
  {
    id: "BK-008", type: "collection", transactionId: "TXN-002",
    personName: "Kofi Mensah", studentId: "STU-3047", role: "buyer",
    scheduledDate: TODAY, scheduledTime: "16:00",
    status: "scheduled", itemName: "Calculus Textbook (Stewart, 9th Ed)",
    notes: "",
  },
  {
    id: "BK-009", type: "collection", transactionId: "TXN-003",
    personName: "Fatima Al-Rashid", studentId: "STU-6631", role: "buyer",
    scheduledDate: TODAY, scheduledTime: "11:30",
    status: "scheduled", itemName: "Mechanical Keyboard (Keychron K2)",
    notes: "Requested original packaging.",
  },
  {
    id: "BK-010", type: "collection", transactionId: "TXN-004",
    personName: "Elena Popescu", studentId: "STU-2298", role: "buyer",
    scheduledDate: "2026-04-07", scheduledTime: "14:00",
    status: "completed", itemName: "Chemistry Lab Coat (Size L)",
    notes: "",
  },
  {
    id: "BK-011", type: "collection", transactionId: "TXN-006",
    personName: "Sipho Zulu", studentId: "STU-4421", role: "buyer",
    scheduledDate: "2026-04-08", scheduledTime: "12:00",
    status: "completed", itemName: "Scientific Calculator (Casio fx-991EX)",
    notes: "",
  },
];

// ── HELPERS ────────────────────────────────────────────────────────────────────

const STATUS_META = {
  awaiting_dropoff:   { label: "Awaiting Drop-off",   cls: "status--awaiting-dropoff", icon: "⏳" },
  item_received:      { label: "Item Received",        cls: "status--item-received",    icon: "📦" },
  awaiting_collection:{ label: "Awaiting Collection",  cls: "status--awaiting-collection", icon: "🔔" },
  item_released:      { label: "Item Released",        cls: "status--item-released",    icon: "✅" },
  completed:          { label: "Completed",            cls: "status--completed",        icon: "🏁" },
  cancelled:          { label: "Cancelled",            cls: "status--cancelled",        icon: "✗"  },
};

const BOOKING_STATUS_META = {
  scheduled:  { label: "Scheduled",  cls: "bstatus--scheduled"  },
  completed:  { label: "Completed",  cls: "bstatus--completed"  },
  no_show:    { label: "No-Show",    cls: "bstatus--no-show"    },
  rescheduled:{ label: "Rescheduled",cls: "bstatus--rescheduled"},
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (dateStr === TODAY) return "Today";
  const diff = Math.round((new Date(dateStr) - new Date(TODAY)) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────────

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
        <span className={`stat-card__icon stat-card__icon--${iconColor}`} aria-hidden="true">
          {icon}
        </span>
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

// ── BOOKING CARD ───────────────────────────────────────────────────────────────

function BookingCard({ booking, transaction, onConfirmReceipt, onConfirmRelease, onMarkNoShow }) {
  const isDropoff    = booking.type === "dropoff";
  const isCollection = booking.type === "collection";
  const isScheduled  = booking.status === "scheduled";
  const isToday      = booking.scheduledDate === TODAY;

  const canConfirmReceipt  = isDropoff    && isScheduled && transaction?.status === "awaiting_dropoff";
  const canConfirmRelease  = isCollection && isScheduled &&
    (transaction?.status === "awaiting_collection" || transaction?.status === "item_received");
  const canMarkNoShow      = isScheduled;

  return (
    <article className={`booking-card ${isToday ? "booking-card--today" : ""}`}>
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
            {isDropoff ? "📥 Drop-off" : "📤 Collection"}
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
            <span className="booking-card__detail-label">Scheduled</span>
            <span className="booking-card__detail-value">
              {formatDate(booking.scheduledDate)} at {booking.scheduledTime}
            </span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Transaction</span>
            <span className="booking-card__detail-value booking-card__txn-id">{booking.transactionId}</span>
          </li>
          {transaction && (
            <li className="booking-card__detail">
              <span className="booking-card__detail-label">Txn Status</span>
              <StatusBadge status={transaction.status} />
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

      {isScheduled && (
        <footer className="booking-card__footer">
          <menu className="booking-card__actions" role="list">
            {canConfirmReceipt && (
              <li>
                <button
                  className="btn-action btn-action--receipt"
                  onClick={() => onConfirmReceipt(booking, transaction)}
                >
                  <span aria-hidden="true">✓</span> Confirm Receipt
                </button>
              </li>
            )}
            {canConfirmRelease && (
              <li>
                <button
                  className="btn-action btn-action--release"
                  onClick={() => onConfirmRelease(booking, transaction)}
                >
                  <span aria-hidden="true">↑</span> Confirm Release
                </button>
              </li>
            )}
            {canMarkNoShow && (
              <li>
                <button
                  className="btn-action btn-action--noshow"
                  onClick={() => onMarkNoShow(booking)}
                >
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
        <span className="confirm-dialog__icon" aria-hidden="true">
          {isReceipt ? "📦" : "📤"}
        </span>
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
            <span className="confirm-dialog__info-value">{dialog.booking.itemName}</span>
          </li>
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">
              {isReceipt ? "Received from" : "Releasing to"}
            </span>
            <span className="confirm-dialog__info-value">
              {dialog.booking.personName}
              <span className="confirm-dialog__info-id"> ({dialog.booking.studentId})</span>
            </span>
          </li>
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">Transaction</span>
            <span className="confirm-dialog__info-value">{dialog.transaction.id}</span>
          </li>
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">Value</span>
            <span className="confirm-dialog__info-value">
              R {dialog.transaction.price.toLocaleString("en-ZA")}
            </span>
          </li>
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

// ── OVERVIEW SECTION ──────────────────────────────────────────────────────────

function OverviewSection({ transactions, bookings }) {
  const active    = transactions.filter((t) => !["completed", "cancelled"].includes(t.status)).length;
  const inCustody = transactions.filter((t) => ["item_received", "awaiting_collection"].includes(t.status)).length;
  const todayDropoffs    = bookings.filter((b) => b.type === "dropoff"    && b.scheduledDate === TODAY && b.status === "scheduled").length;
  const todayCollections = bookings.filter((b) => b.type === "collection" && b.scheduledDate === TODAY && b.status === "scheduled").length;

  const todayDropoffList    = bookings.filter((b) => b.type === "dropoff"    && b.scheduledDate === TODAY && b.status === "scheduled");
  const todayCollectionList = bookings.filter((b) => b.type === "collection" && b.scheduledDate === TODAY && b.status === "scheduled");

  const recentActivity = [...bookings]
    .filter((b) => b.status !== "scheduled")
    .sort((a, b) => (b.scheduledDate > a.scheduledDate ? 1 : -1))
    .slice(0, 5);

  return (
    <section className="view-section" aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="sr-only">Overview</h2>

      <ul className="stats-grid" role="list">
        <li><StatCard icon="🔄" iconColor="blue"   value={active}    label="Active Transactions"  subLabel="In progress" /></li>
        <li><StatCard icon="📥" iconColor="orange"  value={todayDropoffs}    label="Drop-offs Today"  subLabel="Awaiting receipt" /></li>
        <li><StatCard icon="📤" iconColor="purple"  value={todayCollections} label="Collections Today" subLabel="Awaiting release" /></li>
        <li><StatCard icon="🏛️" iconColor="green"   value={inCustody} label="Items in Custody"   subLabel="Held at facility" /></li>
      </ul>

      <section className="overview-grid">
        <article className="panel overview-schedule-panel">
          <header className="panel__header">
            <section>
              <h3 className="panel__title">Today's Drop-offs</h3>
              <p className="panel__subtitle">{formatDate(TODAY)}</p>
            </section>
            <span className="schedule-count">{todayDropoffs} scheduled</span>
          </header>
          {todayDropoffList.length === 0 ? (
            <EmptyState icon="📭" title="No drop-offs today" description="No sellers scheduled for today." />
          ) : (
            <ul className="schedule-list" role="list">
              {todayDropoffList.map((b) => (
                <li key={b.id} className="schedule-item">
                  <span className="schedule-item__time">{b.scheduledTime}</span>
                  <section className="schedule-item__info">
                    <p className="schedule-item__name">{b.personName}</p>
                    <p className="schedule-item__item">{b.itemName}</p>
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
            <span className="schedule-count">{todayCollections} scheduled</span>
          </header>
          {todayCollectionList.length === 0 ? (
            <EmptyState icon="📭" title="No collections today" description="No buyers scheduled for today." />
          ) : (
            <ul className="schedule-list" role="list">
              {todayCollectionList.map((b) => {
                const txn = transactions.find((t) => t.id === b.transactionId);
                return (
                  <li key={b.id} className="schedule-item">
                    <span className="schedule-item__time">{b.scheduledTime}</span>
                    <section className="schedule-item__info">
                      <p className="schedule-item__name">{b.personName}</p>
                      <p className="schedule-item__item">{b.itemName}</p>
                    </section>
                    {txn && <StatusBadge status={txn.status} />}
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </section>

      <article className="panel">
        <header className="panel__header">
          <section>
            <h3 className="panel__title">Recent Activity</h3>
            <p className="panel__subtitle">Latest completed bookings</p>
          </section>
        </header>
        {recentActivity.length === 0 ? (
          <EmptyState icon="📋" title="No recent activity" description="Completed bookings will appear here." />
        ) : (
          <ul className="activity-feed" role="list">
            {recentActivity.map((b) => (
              <li key={b.id} className="activity-item">
                <span className={`activity-item__dot activity-item__dot--${b.type}`} aria-hidden="true" />
                <section className="activity-item__content">
                  <p className="activity-item__text">
                    <strong>{b.personName}</strong>{" "}
                    {b.status === "completed"
                      ? b.type === "dropoff" ? "dropped off" : "collected"
                      : b.status === "no_show" ? "did not show for" : "rescheduled"}{" "}
                    <em>{b.itemName}</em>
                  </p>
                  <p className="activity-item__meta">
                    {b.transactionId} · {formatDate(b.scheduledDate)} at {b.scheduledTime}
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

// ── BOOKINGS SECTION (Dropoffs / Collections) ─────────────────────────────────

function BookingsSection({ type, bookings, transactions, onConfirmReceipt, onConfirmRelease, onMarkNoShow }) {
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("all");

  const isDropoff = type === "dropoff";
  const label     = isDropoff ? "Drop-off" : "Collection";

  const typeBookings = bookings.filter((b) => b.type === type);

  const filtered = typeBookings.filter((b) => {
    const matchSearch =
      !search ||
      b.personName.toLowerCase().includes(search.toLowerCase()) ||
      b.itemName.toLowerCase().includes(search.toLowerCase()) ||
      b.studentId.toLowerCase().includes(search.toLowerCase()) ||
      b.transactionId.toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filter === "all"       ||
      (filter === "today"    && b.scheduledDate === TODAY && b.status === "scheduled") ||
      (filter === "upcoming" && b.scheduledDate > TODAY   && b.status === "scheduled") ||
      (filter === "past"     && b.status === "scheduled"  && b.scheduledDate < TODAY)  ||
      (filter === "completed"&& b.status === "completed") ||
      (filter === "no_show"  && b.status === "no_show");

    return matchSearch && matchFilter;
  });

  const counts = {
    all:       typeBookings.length,
    today:     typeBookings.filter((b) => b.scheduledDate === TODAY && b.status === "scheduled").length,
    upcoming:  typeBookings.filter((b) => b.scheduledDate > TODAY   && b.status === "scheduled").length,
    past:      typeBookings.filter((b) => b.scheduledDate < TODAY   && b.status === "scheduled").length,
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
            placeholder="Search by name, item, student ID or transaction…"
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

        {filtered.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No bookings found"
            description={search ? "Try adjusting your search." : "No bookings match the selected filter."}
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
                    onConfirmReceipt={onConfirmReceipt}
                    onConfirmRelease={onConfirmRelease}
                    onMarkNoShow={onMarkNoShow}
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

// ── TRANSACTIONS SECTION ───────────────────────────────────────────────────────

function TransactionsSection({ transactions, bookings }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = transactions.filter((t) => {
    const matchSearch =
      !search ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.item.toLowerCase().includes(search.toLowerCase()) ||
      t.seller.name.toLowerCase().includes(search.toLowerCase()) ||
      t.buyer.name.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const STATUS_FILTERS = [
    { key: "all",                label: "All" },
    { key: "awaiting_dropoff",   label: "Awaiting Drop-off" },
    { key: "item_received",      label: "Item Received" },
    { key: "awaiting_collection",label: "Awaiting Collection" },
    { key: "item_released",      label: "Released" },
    { key: "completed",          label: "Completed" },
  ];

  return (
    <section className="view-section" aria-labelledby="transactions-heading">
      <h2 id="transactions-heading" className="sr-only">All Transactions</h2>

      <article className="panel">
        <header className="panel__header">
          <section>
            <h3 className="panel__title">All Transactions</h3>
            <p className="panel__subtitle">Complete transaction history and status tracking</p>
          </section>
          <p className="panel__count">{filtered.length} of {transactions.length} transactions</p>
        </header>

        <section className="bookings-controls">
          <label htmlFor="txn-search" className="sr-only">Search transactions</label>
          <input
            id="txn-search"
            type="search"
            className="bookings-search"
            placeholder="Search by transaction ID, item, buyer or seller…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </section>

        <nav className="filter-tabs" aria-label="Filter transactions by status">
          <ul className="filter-tabs__list" role="list">
            {STATUS_FILTERS.map((f) => (
              <li key={f.key}>
                <button
                  className={`filter-tab ${statusFilter === f.key ? "filter-tab--active" : ""}`}
                  onClick={() => setStatusFilter(f.key)}
                  aria-pressed={statusFilter === f.key}
                >
                  {f.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {filtered.length === 0 ? (
          <EmptyState icon="🔍" title="No transactions found" description="Try adjusting your search or filter." />
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
                {filtered.map((t) => {
                  const dropoff    = bookings.find((b) => b.id === t.dropoffId);
                  const collection = bookings.find((b) => b.id === t.collectionId);
                  return (
                    <tr key={t.id}>
                      <td>
                        <span className="txn-id-chip">{t.id}</span>
                        <p className="txn-date">{formatDate(t.createdAt)}</p>
                      </td>
                      <td className="txn-item">{t.item}</td>
                      <td>
                        <section className="txn-person">
                          <Avatar name={t.seller.name} size="sm" />
                          <section>
                            <p className="txn-person__name">{t.seller.name}</p>
                            <p className="txn-person__id">{t.seller.studentId}</p>
                          </section>
                        </section>
                      </td>
                      <td>
                        <section className="txn-person">
                          <Avatar name={t.buyer.name} size="sm" />
                          <section>
                            <p className="txn-person__name">{t.buyer.name}</p>
                            <p className="txn-person__id">{t.buyer.studentId}</p>
                          </section>
                        </section>
                      </td>
                      <td className="txn-price">R {t.price.toLocaleString("en-ZA")}</td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>
                        {dropoff ? (
                          <section className="txn-booking-cell">
                            <p>{formatDate(dropoff.scheduledDate)}</p>
                            <p className="txn-booking-time">{dropoff.scheduledTime}</p>
                            <BookingStatusBadge status={dropoff.status} />
                          </section>
                        ) : <span className="txn-na">—</span>}
                      </td>
                      <td>
                        {collection ? (
                          <section className="txn-booking-cell">
                            <p>{formatDate(collection.scheduledDate)}</p>
                            <p className="txn-booking-time">{collection.scheduledTime}</p>
                            <BookingStatusBadge status={collection.status} />
                          </section>
                        ) : <span className="txn-na">—</span>}
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

// ── MAIN DASHBOARD ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { key: "overview",     label: "Overview",             icon: "🏠" },
  { key: "dropoffs",     label: "Drop-off Bookings",    icon: "📥" },
  { key: "collections",  label: "Collection Bookings",  icon: "📤" },
  { key: "transactions", label: "All Transactions",     icon: "📋" },
];

export default function TradeFacilityDashboard({onSignOut}) {
  const [activeView,    setActiveView]    = useState("overview");
  const [transactions,  setTransactions]  = useState(INITIAL_TRANSACTIONS);
  const [bookings,      setBookings]      = useState(INITIAL_BOOKINGS);
  const [dialog,        setDialog]        = useState(null);
  const [toast,         setToast]         = useState({ msg: "", visible: false });
  const toastTimer = useRef(null);

  // ── Toast ──
  const showToast = useCallback((msg) => {
    setToast({ msg, visible: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg: "", visible: false }), 3200);
  }, []);

  // ── Confirm Receipt ──
  const handleConfirmReceipt = useCallback((booking, transaction) => {
    setDialog({ actionType: "receipt", booking, transaction });
  }, []);

  // ── Confirm Release ──
  const handleConfirmRelease = useCallback((booking, transaction) => {
    setDialog({ actionType: "release", booking, transaction });
  }, []);

  // ── Mark No-Show ──
  const handleMarkNoShow = useCallback((booking) => {
    setBookings((prev) =>
      prev.map((b) => b.id === booking.id ? { ...b, status: "no_show" } : b)
    );
    showToast(`No-show recorded for ${booking.personName}`);
  }, [showToast]);

  // ── Dialog Confirm ──
  const handleDialogConfirm = useCallback(() => {
    if (!dialog) return;
    const { actionType, booking, transaction } = dialog;

    if (actionType === "receipt") {
      setBookings((prev) =>
        prev.map((b) => b.id === booking.id ? { ...b, status: "completed" } : b)
      );
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transaction.id ? { ...t, status: "item_received" } : t
        )
      );
      showToast(`✓ Item received from ${booking.personName} — ${booking.itemName}`);
    } else {
      setBookings((prev) =>
        prev.map((b) => b.id === booking.id ? { ...b, status: "completed" } : b)
      );
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transaction.id ? { ...t, status: "completed" } : t
        )
      );
      showToast(`✓ Item released to ${booking.personName} — transaction complete`);
    }
    setDialog(null);
  }, [dialog, showToast]);

  const handleDialogCancel = useCallback(() => setDialog(null), []);

  // ── Date / time header ──
  const dateLabel = new Date(TODAY + "T00:00:00").toLocaleDateString("en-ZA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const VIEW_TITLES = {
    overview:     "Dashboard Overview",
    dropoffs:     "Drop-off Bookings",
    collections:  "Collection Bookings",
    transactions: "All Transactions",
  };

  // ── Sidebar stats for badge ──
  const pendingDropoffs    = bookings.filter((b) => b.type === "dropoff"    && b.status === "scheduled" && b.scheduledDate === TODAY).length;
  const pendingCollections = bookings.filter((b) => b.type === "collection" && b.status === "scheduled" && b.scheduledDate === TODAY).length;

  return (
    <section className="staff-dashboard-wrapper">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <header className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">🏛️</span>
          <section className="sidebar__brand-text">
            <p className="sidebar__app-name">CampusTrade</p>
            <p className="sidebar__role">Trade Facility</p>
          </section>
        </header>

        <nav aria-label="Dashboard navigation">
          <ul className="sidebar__nav" role="list">
            {NAV_ITEMS.map((item) => {
              const badge =
                item.key === "dropoffs"    ? pendingDropoffs :
                item.key === "collections" ? pendingCollections : 0;
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
                      <span className="sidebar__nav-badge" aria-label={`${badge} pending`}>
                        {badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <footer className="sidebar__footer">
          <span className="staff-avatar" aria-hidden="true">SN</span>
          <section className="staff-info">
            <p className="staff-name">Staff · Nomsa</p>
            <p className="staff-email">nomsa@campus.ac.za</p>
          </section>
          {onSignOut && (
            <button className="sidebar__signout-btn" 
            onClick={onSignOut}
            aria-label="Sign out" title="Sign out">
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
          <OverviewSection transactions={transactions} bookings={bookings} />
        )}
        {activeView === "dropoffs" && (
          <BookingsSection
            type="dropoff"
            bookings={bookings}
            transactions={transactions}
            onConfirmReceipt={handleConfirmReceipt}
            onConfirmRelease={handleConfirmRelease}
            onMarkNoShow={handleMarkNoShow}
          />
        )}
        {activeView === "collections" && (
          <BookingsSection
            type="collection"
            bookings={bookings}
            transactions={transactions}
            onConfirmReceipt={handleConfirmReceipt}
            onConfirmRelease={handleConfirmRelease}
            onMarkNoShow={handleMarkNoShow}
          />
        )}
        {activeView === "transactions" && (
          <TransactionsSection transactions={transactions} bookings={bookings} />
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

      {/* ── Toast Notification ── */}
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
