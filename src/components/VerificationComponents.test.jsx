import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import UnverifiedSellerWarning from "./UnverifiedSellerWarning";
import VerifiedBadge from "./VerifiedBadge";

test("VerifiedBadge renders the badge and university when verified", () => {
  render(
    <VerifiedBadge
      user={{
        email: "student@myuwc.ac.za",
        is_verified: true,
        verified_university: "University of the Western Cape (UWC)",
      }}
      showUniversity
    />,
  );

  expect(screen.getByLabelText(/verified university student/i)).toBeInTheDocument();
  expect(screen.getByText(/university of the western cape/i)).toBeInTheDocument();
});

test("VerifiedBadge stays hidden for unverified users", () => {
  const { container } = render(
    <VerifiedBadge
      user={{
        email: "student@example.com",
        is_verified: false,
        verified_university: null,
      }}
    />,
  );

  expect(container).toBeEmptyDOMElement();
});

test("UnverifiedSellerWarning calls the expected modal actions", () => {
  const onCancel = vi.fn();
  const onContinue = vi.fn();

  render(
    <UnverifiedSellerWarning
      open
      sellerName="Seller Name"
      onCancel={onCancel}
      onContinue={onContinue}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /continue anyway/i }));
  expect(onContinue).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});
