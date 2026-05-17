import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import NotificationBell from "./NotificationBell";
import { NotificationProvider, useNotifications } from "../context/NotificationContext";

function NotificationHarness() {
  const {
    notifyInfo,
    notifyWarning,
    notifySuccess,
    addNotification,
  } = useNotifications();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          notifyInfo("Message received", "A buyer asked about your listing.", {
            category: "messages",
            dedupeKey: "message-1",
            timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          });
          notifyWarning("System notice", "Facility hours changed today.", {
            category: "system",
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          });
          notifySuccess("Already read", "This one starts read.", {
            category: "status",
            unread: false,
            timestamp: "2026-04-01T09:00:00.000Z",
          });
          addNotification({
            title: "Open booking",
            message: "Jump to booking details.",
            category: "sync",
            action: { onClick: vi.fn() },
          });
        }}
      >
        Seed notifications
      </button>
      <NotificationBell />
    </>
  );
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(new Date("2026-05-17T12:00:00.000Z").getTime());
  localStorage.clear();
  window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

test("manages notification filters, actions, read state, removal, and clearing", async () => {
  render(
    <NotificationProvider>
      <NotificationHarness />
    </NotificationProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: /seed notifications/i }));
  fireEvent.click(screen.getByRole("button", { name: /open notifications/i }));

  expect(await screen.findByRole("dialog", { name: /notifications/i })).toBeInTheDocument();
  expect(screen.getByText(/3 unread updates/i)).toBeInTheDocument();
  expect(screen.getByText("Message received")).toBeInTheDocument();
  expect(screen.getByText("2m")).toBeInTheDocument();
  expect(screen.getByText("2h")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: /show unread notifications/i }));
  expect(screen.getByText("Message received")).toBeInTheDocument();
  expect(screen.queryByText("Already read")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /show system and update notifications/i }));
  expect(screen.getByText("System notice")).toBeInTheDocument();
  expect(screen.getByText("Open booking")).toBeInTheDocument();
  expect(screen.queryByText("Message received")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /open booking/i }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /notifications/i })).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: /open notifications/i }));
  fireEvent.click(screen.getByRole("tab", { name: /show all notifications/i }));
  fireEvent.click(screen.getAllByRole("button", { name: /mark notification as read/i })[0]);
  fireEvent.click(screen.getAllByRole("button", { name: /remove notification/i })[0]);
  fireEvent.click(screen.getByRole("button", { name: /mark all notifications as read/i }));
  expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /clear notification history/i }));
  expect(screen.getAllByText(/all caught up/i).length).toBeGreaterThan(0);
  expect(JSON.parse(localStorage.getItem("campusxchange:notifications"))).toEqual([]);
});
