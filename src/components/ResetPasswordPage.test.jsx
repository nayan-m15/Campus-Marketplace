import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import ResetPasswordPage from "./ResetPasswordPage";

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  clearPasswordRecovery: vi.fn(),
}));

vi.mock("../supabaseClient", () => ({
  supabase: {
    auth: {
      updateUser: mocks.updateUser,
    },
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    clearPasswordRecovery: mocks.clearPasswordRecovery,
  }),
}));

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.updateUser.mockResolvedValue({ error: null });
});

test("shows password rule errors before submitting to Supabase", async () => {
  render(<ResetPasswordPage onComplete={vi.fn()} />);

  fireEvent.change(screen.getByLabelText(/^new password$/i), {
    target: { value: "abc" },
  });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), {
    target: { value: "abc" },
  });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));

  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
  expect(screen.getByText(/uppercase letter/i)).toBeInTheDocument();
  expect(screen.getByText(/one number/i)).toBeInTheDocument();
  expect(mocks.updateUser).not.toHaveBeenCalled();
});

test("shows a mismatch error when confirmation does not match", async () => {
  render(<ResetPasswordPage onComplete={vi.fn()} />);

  fireEvent.change(screen.getByLabelText(/^new password$/i), {
    target: { value: "Valid1" },
  });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), {
    target: { value: "Valid2" },
  });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));

  expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  expect(mocks.updateUser).not.toHaveBeenCalled();
});

test("resets the password successfully and continues to the marketplace", async () => {
  const onComplete = vi.fn();

  render(<ResetPasswordPage onComplete={onComplete} />);

  fireEvent.change(screen.getByLabelText(/^new password$/i), {
    target: { value: "Valid1" },
  });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), {
    target: { value: "Valid1" },
  });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));

  await waitFor(() => {
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "Valid1" });
  });
  expect(mocks.clearPasswordRecovery).toHaveBeenCalled();
  expect(await screen.findByText(/password has been reset successfully/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /continue to marketplace/i }));
  expect(onComplete).toHaveBeenCalled();
});

test("continues to the marketplace automatically after a successful reset", async () => {
  const onComplete = vi.fn();

  render(<ResetPasswordPage onComplete={onComplete} autoContinueDelayMs={0} />);

  fireEvent.change(screen.getByLabelText(/^new password$/i), {
    target: { value: "Valid1" },
  });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), {
    target: { value: "Valid1" },
  });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));

  expect(await screen.findByText(/password has been reset successfully/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

test("shows Supabase errors when the password update fails", async () => {
  mocks.updateUser.mockResolvedValue({
    error: { message: "Reset link expired." },
  });

  render(<ResetPasswordPage onComplete={vi.fn()} />);

  fireEvent.change(screen.getByLabelText(/^new password$/i), {
    target: { value: "Valid1" },
  });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), {
    target: { value: "Valid1" },
  });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));

  expect(await screen.findByText(/reset link expired\./i)).toBeInTheDocument();
  expect(mocks.clearPasswordRecovery).not.toHaveBeenCalled();
});
