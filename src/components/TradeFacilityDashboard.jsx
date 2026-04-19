import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import "../styles/TradeFacilityDashboard.css";
import { formatTimestampDate, formatTimestampTime } from "../utils/bookingScheduling";

const TODAY = new Date().toISOString().slice(0, 10);

const STATUS_META = {
  pending: { label: "Pending", cls: "status--awaiting-dropoff", icon: "⏳" },
  awaiting_dropoff: { label: "Awaiting Drop-off", cls: "status--awaiting-dropoff", icon: "📥" },
  dropped_off: { label: "Dropped Off", cls: "status--item-received", icon: "📦" },
  awaiting_collection: { label: "Awaiting Collection", cls: "status--awaiting-collection", icon: "📤" },
  completed: { label: "Completed", cls: "status--completed", icon: "✓" },
  cancelled: { label: "Cancelled", cls: "status--cancelled", icon: "✕" },
};

function initials(name = "") {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

function Avatar({ name, size = "md" }) {
  return <span className={`avatar avatar--${size}`}>{initials(name)}</span>;
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
      <p className="empty-state__title">Loading...</p>
    </section>
  );
}

function ConfirmDialog({ dialog, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && !ref.current.open) {
      ref.current.showModal();
    }
  }, []);

  if (!dialog) return null;

  const isReceipt = dialog.actionType === "receipt";

  return (
    <dialog ref={ref} className="confirm-dialog" onClose={onCancel}>
      <header className="confirm-dialog__header">
        <span className="confirm-dialog__icon" aria-hidden="true">{isReceipt ? "📦" : "📤"}</span>
        <h2 className="confirm-dialog__title">{isReceipt ? "Confirm Item Receipt" : "Confirm Item Release"}</h2>
        <p className="confirm-dialog__subtitle">
          {isReceipt
            ? "Confirm that the seller has dropped the item off at the facility."
            : "Confirm that the buyer has collected the item from the facility."}
        </p>
      </header>
      <section className="confirm-dialog__body">
        <ul className="confirm-dialog__info" role="list">
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">Item</span>
            <span className="confirm-dialog__info-value">{dialog.transaction.item}</span>
          </li>
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">{isReceipt ? "Seller" : "Buyer"}</span>
            <span className="confirm-dialog__info-value">
              {isReceipt
                ? dialog.transaction.seller_profile?.display_name || dialog.transaction.seller_profile?.name || dialog.transaction.seller_id
                : dialog.transaction.buyer_profile?.display_name || dialog.transaction.buyer_profile?.name || dialog.transaction.buyer_id}
            </span>
          </li>
          <li className="confirm-dialog__info-row">
            <span className="confirm-dialog__info-label">Transaction</span>
            <span className="confirm-dialog__info-value">{dialog.transaction.id}</span>
          </li>
        </ul>
      </section>
      <footer className="confirm-dialog__footer">
        <button className="btn-export" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={onConfirm}>
          {isReceipt ? "Confirm Receipt" : "Confirm Release"}
        </button>
      </footer>
    </dialog>
  );
}

function BookingCard({ title, booking, transaction, children }) {
  const person = booking.type === "dropoff" ? transaction.seller_profile : transaction.buyer_profile;
  const isToday = booking.scheduled_time?.slice(0, 10) === TODAY;

  return (
    <article className={`booking-card ${isToday ? "booking-card--today" : ""}`}>
      <header className="booking-card__header">
        <section className="booking-card__header-left">
          <Avatar name={person?.display_name || person?.name || "Unknown"} />
          <section className="booking-card__person-info">
            <p className="booking-card__person-name">{person?.display_name || person?.name || "Unknown user"}</p>
            <p className="booking-card__person-meta">{person?.email || ""}</p>
          </section>
        </section>
        <section className="booking-card__header-right">
          <span className={`booking-type-tag booking-type-tag--${booking.type}`}>
            {booking.type === "dropoff" ? "📥 Drop-off" : "📦 Collection"}
          </span>
          <StatusBadge status={transaction.status} />
        </section>
      </header>

      <section className="booking-card__body">
        <ul className="booking-card__details" role="list">
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">{title}</span>
            <span className="booking-card__detail-value">{transaction.item}</span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Scheduled</span>
            <span className="booking-card__detail-value">
              {formatTimestampDate(booking.scheduled_time)} at {formatTimestampTime(booking.scheduled_time)}
            </span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Location</span>
            <span className="booking-card__detail-value">{booking.location}</span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Transaction</span>
            <span className="booking-card__detail-value booking-card__txn-id">{transaction.id}</span>
          </li>
          <li className="booking-card__detail">
            <span className="booking-card__detail-label">Price</span>
            <span className="booking-card__detail-value">R {Number(transaction.price || 0).toLocaleString("en-ZA")}</span>
          </li>
        </ul>
      </section>

      {children ? <footer className="booking-card__footer">{children}</footer> : null}
    </article>
  );
}

function BookingListSection({ title, subtitle, bookings, loading, emptyState, renderActions }) {
  return (
    <section className="view-section">
      <article className="panel">
        <header className="panel__header">
          <section>
            <h3 className="panel__title">{title}</h3>
            <p className="panel__subtitle">{subtitle}</p>
          </section>
          {bookings.length > 0 ? <span className="schedule-count">{bookings.length}</span> : null}
        </header>

        {loading ? (
          <LoadingState />
        ) : bookings.length === 0 ? (
          <EmptyState {...emptyState} />
        ) : (
          <ul className="booking-list" role="list">
            {bookings.map(({ booking, transaction }) => (
              <li key={booking.id}>
                <BookingCard
                  booking={booking}
                  transaction={transaction}
                  title={booking.type === "dropoff" ? "Drop-off" : "Collection"}
                >
                  {renderActions?.({ booking, transaction })}
                </BookingCard>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "🏠" },
  { key: "dropoffs", label: "Drop-off Bookings", icon: "📥" },
  { key: "collections", label: "Collection Bookings", icon: "📦" },
  { key: "transactions", label: "All Transactions", icon: "📋" },
];

export default function TradeFacilityDashboard({ onSignOut, staffProfile }) {
  const [activeView, setActiveView] = useState("overview");
  const [dashboardData, setDashboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState({ visible: false, msg: "" });
  const toastTimer = useRef(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);

    try {
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (transactionsError) throw transactionsError;

      const transactions = transactionsData || [];
      const bookingIds = transactions.flatMap((transaction) => [transaction.dropoff_id, transaction.collection_id]).filter(Boolean);
      const profileIds = [...new Set(transactions.flatMap((transaction) => [transaction.seller_id, transaction.buyer_id]).filter(Boolean))];

      const [{ data: bookingsData }, { data: profilesData }] = await Promise.all([
        bookingIds.length
          ? supabase.from("bookings").select("*").in("id", bookingIds)
          : Promise.resolve({ data: [] }),
        profileIds.length
          ? supabase.from("profiles").select("id, name, display_name, email").in("id", profileIds)
          : Promise.resolve({ data: [] }),
      ]);

      const bookingsById = Object.fromEntries((bookingsData || []).map((booking) => [booking.id, booking]));
      const profilesById = Object.fromEntries((profilesData || []).map((profile) => [profile.id, profile]));

      setDashboardData(transactions.map((transaction) => ({
        ...transaction,
        seller_profile: profilesById[transaction.seller_id] || null,
        buyer_profile: profilesById[transaction.buyer_id] || null,
        dropoff_booking: transaction.dropoff_id ? bookingsById[transaction.dropoff_id] || null : null,
        collection_booking: transaction.collection_id ? bookingsById[transaction.collection_id] || null : null,
      })));
    } catch (error) {
      console.error("Failed to load facility dashboard:", error.message);
      setDashboardData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const channel = supabase
      .channel("facility-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, loadDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, loadDashboard)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  const showToast = useCallback((msg) => {
    setToast({ visible: true, msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ visible: false, msg: "" }), 3000);
  }, []);

  const handleConfirmReceipt = useCallback((transaction) => {
    setDialog({ actionType: "receipt", transaction });
  }, []);

  const handleConfirmRelease = useCallback((transaction) => {
    setDialog({ actionType: "release", transaction });
  }, []);

  const handleDialogConfirm = useCallback(async () => {
    if (!dialog) return;

    const nextStatus = dialog.actionType === "receipt"
      ? (dialog.transaction.collection_id ? "awaiting_collection" : "dropped_off")
      : "completed";

    const { error } = await supabase
      .from("transactions")
      .update({ status: nextStatus })
      .eq("id", dialog.transaction.id);

    if (!error) {
      showToast(dialog.actionType === "receipt" ? "Item receipt confirmed." : "Item release confirmed.");
      loadDashboard();
    }

    setDialog(null);
  }, [dialog, loadDashboard, showToast]);

  const dropoffBookings = dashboardData
    .filter((transaction) => transaction.dropoff_booking)
    .map((transaction) => ({ booking: transaction.dropoff_booking, transaction }))
    .sort((a, b) => new Date(a.booking.scheduled_time) - new Date(b.booking.scheduled_time));

  const collectionBookings = dashboardData
    .filter((transaction) => transaction.collection_booking)
    .map((transaction) => ({ booking: transaction.collection_booking, transaction }))
    .sort((a, b) => new Date(a.booking.scheduled_time) - new Date(b.booking.scheduled_time));

  const dueTodayDropoffs = dropoffBookings.filter(({ booking, transaction }) => booking.scheduled_time?.slice(0, 10) === TODAY && transaction.status === "awaiting_dropoff");
  const dueTodayCollections = collectionBookings.filter(({ booking, transaction }) => booking.scheduled_time?.slice(0, 10) === TODAY && transaction.status === "awaiting_collection");
  const completedCount = dashboardData.filter((transaction) => transaction.status === "completed").length;
  const activeCount = dashboardData.filter((transaction) => !["completed", "cancelled"].includes(transaction.status)).length;

  const dateLabel = new Date(`${TODAY}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <section className="staff-dashboard-wrapper">
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
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <button
                  className={`sidebar__nav-btn ${activeView === item.key ? "sidebar__nav-btn--active" : ""}`}
                  onClick={() => setActiveView(item.key)}
                >
                  <span className="sidebar__nav-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <footer className="sidebar__footer">
          <span className="staff-avatar" aria-hidden="true">{initials(staffProfile?.display_name || "Staff")}</span>
          <section className="staff-info">
            <p className="staff-name">{staffProfile?.display_name || "Staff"}</p>
            <p className="staff-email">{staffProfile?.email || ""}</p>
          </section>
          {onSignOut ? (
            <button className="sidebar__signout-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">⏻</button>
          ) : null}
        </footer>
      </aside>

      <main className="dashboard-main" id="main-content">
        <header className="dashboard-topbar">
          <section className="topbar-left">
            <h1 className="topbar-title">
              {activeView === "overview"
                ? "Dashboard Overview"
                : activeView === "dropoffs"
                  ? "Drop-off Bookings"
                  : activeView === "collections"
                    ? "Collection Bookings"
                    : "All Transactions"}
            </h1>
            <p className="topbar-date">{dateLabel}</p>
          </section>
          <section className="topbar-right">
            <span className="facility-open-badge">
              <span className="facility-open-dot" aria-hidden="true" />
              Facility Open
            </span>
          </section>
        </header>

        {activeView === "overview" ? (
          <section className="view-section">
            <ul className="stats-grid" role="list">
              <li>
                <article className="stat-card">
                  <header className="stat-card__top"><span className="stat-card__icon stat-card__icon--green">📥</span></header>
                  <p className="stat-card__value">{dueTodayDropoffs.length}</p>
                  <footer className="stat-card__footer">
                    <p className="stat-card__label">Today&apos;s Drop-offs</p>
                    <p className="stat-card__sublabel">Sellers expected today</p>
                  </footer>
                </article>
              </li>
              <li>
                <article className="stat-card">
                  <header className="stat-card__top"><span className="stat-card__icon stat-card__icon--blue">📦</span></header>
                  <p className="stat-card__value">{dueTodayCollections.length}</p>
                  <footer className="stat-card__footer">
                    <p className="stat-card__label">Today&apos;s Collections</p>
                    <p className="stat-card__sublabel">Buyers expected today</p>
                  </footer>
                </article>
              </li>
              <li>
                <article className="stat-card">
                  <header className="stat-card__top"><span className="stat-card__icon stat-card__icon--orange">⏳</span></header>
                  <p className="stat-card__value">{activeCount}</p>
                  <footer className="stat-card__footer">
                    <p className="stat-card__label">Active Transactions</p>
                    <p className="stat-card__sublabel">Still in facility workflow</p>
                  </footer>
                </article>
              </li>
              <li>
                <article className="stat-card">
                  <header className="stat-card__top"><span className="stat-card__icon stat-card__icon--purple">✓</span></header>
                  <p className="stat-card__value">{completedCount}</p>
                  <footer className="stat-card__footer">
                    <p className="stat-card__label">Completed</p>
                    <p className="stat-card__sublabel">Transactions fully released</p>
                  </footer>
                </article>
              </li>
            </ul>

            <div className="overview-grid">
              <BookingListSection
                title="Due for Drop-off"
                subtitle="Transactions waiting for seller handover"
                bookings={dueTodayDropoffs}
                loading={loading}
                emptyState={{ icon: "📭", title: "No drop-offs due today", description: "Nothing scheduled for seller handover today." }}
                renderActions={({ transaction }) => (
                  transaction.status === "awaiting_dropoff" ? (
                    <menu className="booking-card__actions" role="list">
                      <li>
                        <button className="btn-action btn-action--receipt" onClick={() => handleConfirmReceipt(transaction)}>
                          Confirm Receipt
                        </button>
                      </li>
                    </menu>
                  ) : null
                )}
              />

              <BookingListSection
                title="Due for Collection"
                subtitle="Transactions ready for buyer handover"
                bookings={dueTodayCollections}
                loading={loading}
                emptyState={{ icon: "📭", title: "No collections due today", description: "Nothing scheduled for buyer release today." }}
                renderActions={({ transaction }) => (
                  transaction.status === "awaiting_collection" ? (
                    <menu className="booking-card__actions" role="list">
                      <li>
                        <button className="btn-action btn-action--release" onClick={() => handleConfirmRelease(transaction)}>
                          Confirm Release
                        </button>
                      </li>
                    </menu>
                  ) : null
                )}
              />
            </div>
          </section>
        ) : null}

        {activeView === "dropoffs" ? (
          <BookingListSection
            title="Drop-off Bookings"
            subtitle="Manage seller arrivals and confirm received items"
            bookings={dropoffBookings}
            loading={loading}
            emptyState={{ icon: "📥", title: "No drop-offs booked", description: "Drop-off bookings will appear here once sellers choose a slot." }}
            renderActions={({ transaction }) => (
              transaction.status === "awaiting_dropoff" ? (
                <menu className="booking-card__actions" role="list">
                  <li>
                    <button className="btn-action btn-action--receipt" onClick={() => handleConfirmReceipt(transaction)}>
                      Confirm Receipt
                    </button>
                  </li>
                </menu>
              ) : null
            )}
          />
        ) : null}

        {activeView === "collections" ? (
          <BookingListSection
            title="Collection Bookings"
            subtitle="Manage buyer pickups and complete handover"
            bookings={collectionBookings}
            loading={loading}
            emptyState={{ icon: "📦", title: "No collections booked", description: "Collection bookings will appear here after items are dropped off." }}
            renderActions={({ transaction }) => (
              transaction.status === "awaiting_collection" ? (
                <menu className="booking-card__actions" role="list">
                  <li>
                    <button className="btn-action btn-action--release" onClick={() => handleConfirmRelease(transaction)}>
                      Confirm Release
                    </button>
                  </li>
                </menu>
              ) : null
            )}
          />
        ) : null}

        {activeView === "transactions" ? (
          <section className="view-section">
            <article className="panel">
              <header className="panel__header">
                <section>
                  <h3 className="panel__title">All Transactions</h3>
                  <p className="panel__subtitle">Full facility handover pipeline across drop-off and collection.</p>
                </section>
              </header>

              {loading ? (
                <LoadingState />
              ) : dashboardData.length === 0 ? (
                <EmptyState icon="📋" title="No transactions yet" description="Transactions will appear here once a trade reaches the facility flow." />
              ) : (
                <figure className="table-figure">
                  <table className="report-table transactions-table">
                    <thead>
                      <tr>
                        <th>Transaction</th>
                        <th>Seller</th>
                        <th>Buyer</th>
                        <th>Status</th>
                        <th>Drop-off</th>
                        <th>Collection</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>
                            <span className="txn-id-chip">{transaction.id}</span>
                            <div className="txn-date">{transaction.item}</div>
                          </td>
                          <td>{transaction.seller_profile?.display_name || transaction.seller_profile?.name || transaction.seller_id}</td>
                          <td>{transaction.buyer_profile?.display_name || transaction.buyer_profile?.name || transaction.buyer_id}</td>
                          <td><StatusBadge status={transaction.status} /></td>
                          <td className="txn-booking-cell">
                            {transaction.dropoff_booking ? (
                              <>
                                <p>{transaction.dropoff_booking.location}</p>
                                <p className="txn-booking-time">
                                  {formatTimestampDate(transaction.dropoff_booking.scheduled_time)} {formatTimestampTime(transaction.dropoff_booking.scheduled_time)}
                                </p>
                              </>
                            ) : (
                              <span className="txn-na">-</span>
                            )}
                          </td>
                          <td className="txn-booking-cell">
                            {transaction.collection_booking ? (
                              <>
                                <p>{transaction.collection_booking.location}</p>
                                <p className="txn-booking-time">
                                  {formatTimestampDate(transaction.collection_booking.scheduled_time)} {formatTimestampTime(transaction.collection_booking.scheduled_time)}
                                </p>
                              </>
                            ) : (
                              <span className="txn-na">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </figure>
              )}
            </article>
          </section>
        ) : null}
      </main>

      {dialog ? <ConfirmDialog dialog={dialog} onConfirm={handleDialogConfirm} onCancel={() => setDialog(null)} /> : null}

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
