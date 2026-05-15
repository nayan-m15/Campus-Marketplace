import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNotifications } from "../context/NotificationContext";
import "../styles/NotificationBell.css";

function useMediaQuery(query) {
  const getMatch = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event) => setMatches(event.matches);

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

function BellIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...props}>
      <path d="M15 18H5.5a1.5 1.5 0 0 1-1.2-2.4l1.1-1.46a4 4 0 0 0 .82-2.42V9.75a5.78 5.78 0 1 1 11.56 0v1.93a4 4 0 0 0 .82 2.42l1.1 1.46a1.5 1.5 0 0 1-1.2 2.4H15Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </svg>
  );
}

function SparkIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" strokeLinejoin="round" />
      <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" strokeLinejoin="round" />
    </svg>
  );
}

function SlidersIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 6h8" strokeLinecap="round" />
      <path d="M16 6h4" strokeLinecap="round" />
      <path d="M4 12h4" strokeLinecap="round" />
      <path d="M12 12h8" strokeLinecap="round" />
      <path d="M4 18h10" strokeLinecap="round" />
      <path d="M18 18h2" strokeLinecap="round" />
      <circle cx="14" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  );
}

function CheckIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m5 12 4.2 4.2L19 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M5 12h14" strokeLinecap="round" />
      <path d="m13 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M18 6 6 18" strokeLinecap="round" />
      <path d="m6 6 12 12" strokeLinecap="round" />
    </svg>
  );
}

const TAB_ITEMS = [
  { id: "all", icon: GridIcon, label: "Show all notifications" },
  { id: "unread", icon: BellIcon, label: "Show unread notifications" },
  { id: "system", icon: SparkIcon, label: "Show system and update notifications" },
];

function getTypeAccent(type) {
  if (type === "success") return "primary";
  if (type === "warning") return "warning";
  if (type === "error") return "danger";
  return "muted";
}

function formatNotificationTime(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  const deltaMs = Date.now() - date.getTime();
  const minutes = Math.round(deltaMs / 60000);

  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

function NotificationTypeIcon({ type }) {
  if (type === "success") return <CheckIcon aria-hidden="true" />;
  if (type === "warning") return <SparkIcon aria-hidden="true" />;
  if (type === "error") return <CloseIcon aria-hidden="true" />;
  return <BellIcon aria-hidden="true" />;
}

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    toggleRead,
    removeNotification,
    markAllRead,
    clearAll,
    runNotificationAction,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [panelStyle, setPanelStyle] = useState(null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const panelId = useId();

  const visibleItems = useMemo(() => {
    if (activeTab === "unread") return notifications.filter((item) => item.unread);
    if (activeTab === "system") {
      return notifications.filter((item) => ["system", "sync", "status", "warning"].includes(item.category));
    }
    return notifications;
  }, [activeTab, notifications]);

  useEffect(() => {
    if (!open || isMobile || !buttonRef.current) return undefined;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const panelWidth = Math.min(388, window.innerWidth - 24);
      const left = Math.min(
        Math.max(12, rect.right - panelWidth),
        window.innerWidth - panelWidth - 12,
      );

      setPanelStyle({
        top: rect.bottom + 14,
        left,
        width: panelWidth,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isMobile, open]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(focusFrame);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function getFocusableElements() {
      if (!panelRef.current) return [];
      return [...panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute("hidden"));
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements();
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function handlePointerDown(event) {
      const target = event.target;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPanelStyle(null);
    }
  }, [open]);

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev;
      if (prev && buttonRef.current) {
        window.requestAnimationFrame(() => buttonRef.current?.focus());
      }
      return next;
    });
  }

  function closePanel() {
    setOpen(false);
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  }

  return (
    <div className="notification-bell">
      <button
        ref={buttonRef}
        type="button"
        className={`navbar__icon-btn notification-bell__trigger${open ? " notification-bell__trigger--open" : ""}`}
        aria-label="Open notifications"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
      >
        <span className="notification-bell__trigger-wrap">
          <BellIcon aria-hidden="true" />
          {unreadCount > 0 && <span className="notification-bell__badge" aria-hidden="true" />}
        </span>
      </button>

      {open && (
        <>
          <div className="notification-bell__backdrop" aria-hidden="true" onClick={closePanel} />

          <section
            id={panelId}
            ref={panelRef}
            className={`notification-bell__panel${isMobile ? " notification-bell__panel--mobile" : ""}`}
            style={isMobile ? undefined : panelStyle}
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
          >
            <header className="notification-bell__header">
              <div className="notification-bell__header-main">
                <div className="notification-bell__header-glyph" aria-hidden="true">
                  <BellIcon />
                </div>

                <div className="notification-bell__header-actions">
                  <button
                    type="button"
                    className="notification-bell__icon-button"
                    aria-label="Notification settings"
                  >
                    <SlidersIcon aria-hidden="true" />
                  </button>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    className="notification-bell__icon-button"
                    aria-label="Close notifications"
                    onClick={closePanel}
                  >
                    <CloseIcon aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="notification-bell__tabs" role="tablist" aria-label="Notification filters">
                {TAB_ITEMS.map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === id}
                    aria-label={label}
                    className={`notification-bell__tab${activeTab === id ? " notification-bell__tab--active" : ""}`}
                    onClick={() => setActiveTab(id)}
                  >
                    <Icon aria-hidden="true" />
                  </button>
                ))}
              </div>
            </header>

            <div className="notification-bell__list" aria-live="polite">
              {visibleItems.length === 0 && (
                <div className="notification-bell__empty" aria-live="polite">
                  <span className="notification-bell__empty-glyph" aria-hidden="true">
                    <BellIcon />
                  </span>
                  <span className="notification-bell__empty-title">All caught up</span>
                  <span className="notification-bell__empty-meta">New alerts and updates will appear here.</span>
                </div>
              )}

              {visibleItems.map((item) => (
                <article
                  key={item.id}
                  className={`notification-bell__item${item.isNew ? " notification-bell__item--new" : ""}`}
                >
                  <button
                    type="button"
                    className="notification-bell__item-main"
                    aria-label={
                      item.action?.onClick
                        ? `${item.title}. ${item.message}. Open notification action.`
                        : `${item.title}. ${item.message}. ${item.unread ? "Mark notification as read" : "Mark notification as unread"}`
                    }
                    onClick={() => {
                      if (item.action?.onClick) {
                        runNotificationAction(item.id);
                        closePanel();
                        return;
                      }

                      toggleRead(item.id);
                    }}
                  >
                    <span className={`notification-bell__avatar notification-bell__avatar--${getTypeAccent(item.type)}`} aria-hidden="true">
                      <NotificationTypeIcon type={item.type} />
                    </span>

                    <span className="notification-bell__content">
                      <span className="notification-bell__label-row">
                        <span className="notification-bell__label">{item.title}</span>
                        <span className="notification-bell__timestamp">{formatNotificationTime(item.timestamp)}</span>
                      </span>
                      <span className="notification-bell__meta">{item.message}</span>
                      <span className="notification-bell__category">{item.category}</span>
                    </span>
                  </button>

                  <span className="notification-bell__item-side">
                    <button
                      type="button"
                      className="notification-bell__item-control"
                      aria-label={item.unread ? "Mark notification as read" : "Mark notification as unread"}
                      onClick={() => toggleRead(item.id)}
                    >
                      {item.unread ? <span className="notification-bell__item-dot" aria-hidden="true" /> : <CheckIcon aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className="notification-bell__item-control"
                      aria-label="Remove notification"
                      onClick={() => removeNotification(item.id)}
                    >
                      <CloseIcon aria-hidden="true" />
                    </button>
                  </span>
                </article>
              ))}
            </div>

            <footer className="notification-bell__footer">
              <button
                type="button"
                className="notification-bell__footer-button"
                aria-label="Mark all notifications as read"
                onClick={markAllRead}
              >
                <CheckIcon aria-hidden="true" />
              </button>

              <button
                type="button"
                className="notification-bell__footer-button notification-bell__footer-button--primary"
                aria-label="Clear notification history"
                onClick={clearAll}
              >
                <ArrowIcon aria-hidden="true" />
              </button>
            </footer>
          </section>
        </>
      )}
    </div>
  );
}
