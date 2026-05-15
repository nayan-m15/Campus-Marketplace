import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import HowItWorksPage from "./HowItWorksPage";

describe("HowItWorksPage", () => {
  test("renders the student, staff, and admin content from the documented flows", () => {
    render(
      <HowItWorksPage
        user={null}
        onBrowseClick={vi.fn()}
        onSignupClick={vi.fn()}
        onLoginClick={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: /how it works/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /the student journey from discovery to handover/i })).toBeInTheDocument();
    expect(screen.getByText(/open the website/i)).toBeInTheDocument();
    expect(screen.getByText(/use the booking flow for facility handovers/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /staff keep facility-based exchanges organised/i })).toBeInTheDocument();
    expect(screen.getByText(/coordinate drop-offs and collections between marketplace users/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /admins manage trust, settings, and reporting/i })).toBeInTheDocument();
    expect(screen.getByText(/generate marketplace reports and exports/i)).toBeInTheDocument();
  });
});
