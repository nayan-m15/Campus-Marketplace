import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import FacilitiesManagementPanel from "./FacilitiesManagementPanel";
import { NotificationProvider } from "../context/NotificationContext";

const mocks = vi.hoisted(() => ({
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  facilities: [],
  selectFacilitiesError: null,
  refreshFacility: null,
  update: vi.fn(),
  insert: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
}));

function facilityRow(overrides = {}) {
  return {
    id: "facility-1",
    name: "Main Library",
    description: "Quiet handover desk near circulation.",
    location: "Building A",
    image_url: "https://example.com/library.jpg",
    capacity: 8,
    session_duration_minutes: 30,
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    facility_hours: [
      { day: "Monday", open: true, start_time: "09:00:00", end_time: "17:00:00" },
      { day: "Tuesday", open: false, start_time: "09:00:00", end_time: "17:00:00" },
    ],
    ...overrides,
  };
}

function makeQuery(table, filters = {}) {
  const query = {
    select: () => query,
    order: () => {
      if (table === "facilities") {
        return Promise.resolve({ data: mocks.facilities, error: mocks.selectFacilitiesError });
      }
      return Promise.resolve({ data: [], error: null });
    },
    eq: (column, value) => {
      filters[column] = value;
      return query;
    },
    maybeSingle: () => Promise.resolve({
      data: mocks.refreshFacility || facilityRow({ id: filters.id || "facility-1" }),
      error: null,
    }),
    single: () => Promise.resolve({ data: { id: "created-facility" }, error: null }),
    update: (payload) => {
      mocks.update(table, payload);
      return query;
    },
    insert: (payload) => {
      mocks.insert(table, payload);
      return query;
    },
    upsert: (payload, options) => {
      mocks.upsert(table, payload, options);
      return query;
    },
    delete: () => {
      mocks.delete(table);
      return query;
    },
  };
  return query;
}

vi.mock("../supabaseClient", () => ({
  supabase: {
    from: (table) => makeQuery(table),
  },
}));

vi.mock("../utils/bookingScheduling", () => ({
  DAYS: mocks.days,
  normalizeFacilityDay: (day) => day,
}));

function renderWithNotifications(ui) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.facilities = [];
  mocks.selectFacilitiesError = null;
  mocks.refreshFacility = null;
  window.confirm = vi.fn(() => true);
});

describe("FacilitiesManagementPanel", () => {
  test("renders loading then empty state and opens validation for a new facility", async () => {
    renderWithNotifications(<FacilitiesManagementPanel />);

    expect(screen.getByText("Facilities Management")).toBeInTheDocument();
    expect(screen.getByText(/loading facilities/i)).toBeInTheDocument();
    expect(await screen.findByText("No facilities found")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add first facility/i }));
    expect(screen.getByRole("heading", { name: /add new facility/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /create facility/i }));
    expect(screen.getByText(/facility name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one day must be open/i)).toBeInTheDocument();
  });

  test("creates a facility with hours payload and closes the modal", async () => {
    renderWithNotifications(<FacilitiesManagementPanel />);

    fireEvent.click(await screen.findByRole("button", { name: /add first facility/i }));
    fireEvent.change(screen.getByLabelText(/facility name/i), { target: { value: "Science Desk" } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Lab-side support desk." } });
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: "Science Block" } });
    fireEvent.change(screen.getByLabelText(/image url/i), { target: { value: "https://example.com/science.jpg" } });
    fireEvent.change(screen.getByLabelText(/capacity per session/i), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText(/session duration/i), { target: { value: "45" } });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);

    const timeInputs = document.querySelectorAll(".time-input");
    fireEvent.change(timeInputs[0], { target: { value: "08:30" } });
    fireEvent.change(timeInputs[1], { target: { value: "16:30" } });
    fireEvent.click(screen.getByRole("button", { name: /create facility/i }));

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(
      "facilities",
      expect.objectContaining({
        name: "Science Desk",
        location: "Science Block",
        capacity: 12,
        session_duration_minutes: 45,
      }),
    ));
    expect(mocks.insert).toHaveBeenCalledWith(
      "facility_hours",
      expect.arrayContaining([
        expect.objectContaining({
          facility_id: "created-facility",
          day: "Monday",
          open: true,
          start_time: "08:30",
          end_time: "16:30",
        }),
      ]),
    );
  });

  test("filters, edits, toggles status, deletes, and handles image fallback", async () => {
    mocks.facilities = [
      facilityRow(),
      facilityRow({
        id: "facility-2",
        name: "Dorm Desk",
        description: "Residence collection point.",
        location: "North Residence",
        image_url: "",
        status: "inactive",
      }),
    ];
    mocks.refreshFacility = facilityRow({ name: "Main Library Updated" });

    renderWithNotifications(<FacilitiesManagementPanel />);

    expect(await screen.findByRole("heading", { name: /main library/i })).toBeInTheDocument();
    fireEvent.error(screen.getByAltText("Main Library"));
    expect(screen.getAllByText("FC").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText(/search facilities/i), {
      target: { value: "dorm" },
    });
    expect(screen.getByRole("heading", { name: /dorm desk/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /main library/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search facilities/i), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByDisplayValue("All Status"), { target: { value: "active" } });
    expect(screen.getByRole("heading", { name: /main library/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /dorm desk/i })).not.toBeInTheDocument();

    const card = screen.getByRole("heading", { name: /main library/i }).closest(".facility-management-card");
    fireEvent.click(within(card).getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("heading", { name: /edit facility/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/facility name/i), { target: { value: "Main Library Updated" } });
    fireEvent.click(screen.getByRole("button", { name: /update facility/i }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(
      "facilities",
      expect.objectContaining({ name: "Main Library Updated" }),
    ));
    expect(mocks.upsert).toHaveBeenCalledWith(
      "facility_hours",
      expect.any(Array),
      { onConflict: "facility_id,day" },
    );

    fireEvent.click(within(card).getByRole("button", { name: /deactivate/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("facilities", { status: "inactive" }));

    fireEvent.click(within(card).getByRole("button", { name: /delete/i }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Main Library"));
    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("facility_hours"));
    expect(mocks.delete).toHaveBeenCalledWith("facilities");
  });

  test("shows error and retry when loading fails", async () => {
    mocks.selectFacilitiesError = { message: "network down" };
    renderWithNotifications(<FacilitiesManagementPanel />);

    expect(await screen.findByText(/failed to load facilities/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/loading facilities/i)).toBeInTheDocument());
  });

  test("cancels delete when the confirmation is rejected", async () => {
    window.confirm = vi.fn(() => false);
    mocks.facilities = [facilityRow()];

    renderWithNotifications(<FacilitiesManagementPanel />);

    const card = (await screen.findByRole("heading", { name: /main library/i })).closest(".facility-management-card");
    fireEvent.click(within(card).getByRole("button", { name: /delete/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});
