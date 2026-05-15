import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const NOTIFICATION_STORAGE_KEY = "campusxchange:notifications";
const MAX_NOTIFICATIONS = 80;
const DUPLICATE_WINDOW_MS = 5000;

const NotificationContext = createContext(null);

function sanitizePersistedItem(item) {
  return {
    id: item.id,
    title: item.title || "",
    message: item.message || "",
    category: item.category || "general",
    type: item.type || "info",
    icon: item.icon || "bell",
    timestamp: item.timestamp || new Date().toISOString(),
    unread: item.unread !== false,
    dedupeKey: item.dedupeKey || null,
  };
}

function readPersistedNotifications() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizePersistedItem).slice(0, MAX_NOTIFICATIONS);
  } catch {
    return [];
  }
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(readPersistedNotifications);
  const duplicateMapRef = useRef(new Map());
  const newestTimersRef = useRef(new Map());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload = notifications
      .map((item) => sanitizePersistedItem(item))
      .slice(0, MAX_NOTIFICATIONS);

    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(payload));
  }, [notifications]);

  useEffect(() => () => {
    newestTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    newestTimersRef.current.clear();
  }, []);

  const addNotification = useCallback((input) => {
    const now = Date.now();
    const notification = {
      id: input.id || `notif-${now}-${Math.random().toString(36).slice(2, 8)}`,
      title: input.title || "Update",
      message: input.message || "",
      category: input.category || "general",
      type: input.type || "info",
      icon: input.icon || "bell",
      timestamp: input.timestamp || new Date(now).toISOString(),
      unread: input.unread !== false,
      dedupeKey: input.dedupeKey || null,
      action: input.action || null,
      isNew: true,
    };

    setNotifications((current) => {
      if (notification.dedupeKey) {
        const previous = duplicateMapRef.current.get(notification.dedupeKey);
        const existingIndex = current.findIndex((item) => item.dedupeKey === notification.dedupeKey);

        if (existingIndex >= 0 && previous && now - previous < DUPLICATE_WINDOW_MS) {
          const next = [...current];
          const existing = next[existingIndex];
          next[existingIndex] = {
            ...existing,
            ...notification,
            id: existing.id,
          };
          duplicateMapRef.current.set(notification.dedupeKey, now);
          return next.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }

        duplicateMapRef.current.set(notification.dedupeKey, now);
      }

      return [notification, ...current].slice(0, MAX_NOTIFICATIONS);
    });

    const existingTimer = newestTimersRef.current.get(notification.id);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const timerId = window.setTimeout(() => {
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, isNew: false } : item
      )));
      newestTimersRef.current.delete(notification.id);
    }, 2400);

    newestTimersRef.current.set(notification.id, timerId);

    return notification.id;
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications((current) => current.map((item) => (
      item.id === id ? { ...item, unread: false } : item
    )));
  }, []);

  const toggleRead = useCallback((id) => {
    setNotifications((current) => current.map((item) => (
      item.id === id ? { ...item, unread: !item.unread } : item
    )));
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
    const timerId = newestTimersRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      newestTimersRef.current.delete(id);
    }
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })));
  }, []);

  const clearAll = useCallback(() => {
    newestTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    newestTimersRef.current.clear();
    setNotifications([]);
  }, []);

  const runNotificationAction = useCallback((id) => {
    const item = notifications.find((entry) => entry.id === id);
    if (!item?.action?.onClick) return;
    item.action.onClick();
    markAsRead(id);
  }, [markAsRead, notifications]);

  const value = useMemo(() => ({
    notifications,
    unreadCount: notifications.filter((item) => item.unread).length,
    addNotification,
    notifySuccess: (title, message, options = {}) => addNotification({ ...options, title, message, type: "success" }),
    notifyError: (title, message, options = {}) => addNotification({ ...options, title, message, type: "error" }),
    notifyWarning: (title, message, options = {}) => addNotification({ ...options, title, message, type: "warning" }),
    notifyInfo: (title, message, options = {}) => addNotification({ ...options, title, message, type: "info" }),
    markAsRead,
    toggleRead,
    removeNotification,
    markAllRead,
    clearAll,
    runNotificationAction,
  }), [addNotification, clearAll, markAllRead, markAsRead, notifications, removeNotification, runNotificationAction, toggleRead]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return value;
}
