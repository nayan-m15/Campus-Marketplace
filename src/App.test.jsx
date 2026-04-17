import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App";

vi.mock("./supabaseClient", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock("./components/Hero", () => ({
  default: ({ onBrowseClick, onSignupClick, onLoginClick }) => (
    <section aria-label="Hero">
      <button onClick={onBrowseClick}>Start Browsing</button>
      <button onClick={onSignupClick}>Start listing</button>
      <button onClick={onLoginClick}>Already have an account? Sign in</button>
    </section>
  ),
}));

vi.mock("./data/listings", () => ({
  fetchListings: () =>
    Promise.resolve([
      {
        id: "1",
        title: "Sony PS5",
        price: "R 10 999",
        pricePrefix: "",
        condition: "Good",
        category: "Electronics",
        seller: "Saurav",
        distance: "0 km",
        image_url: "/ps5-1.jpg",
        image_urls: ["/ps5-1.jpg", "/ps5-2.jpg"],
        emoji: "Gamepad",
        rating: 4,
        reviewCount: 2,
        user_id: "user-abc",
        description: "Great console.",
        approximate_location: "Johannesburg",
        institution: "Wits",
        joined_year: 2024,
        created_at: "2026-02-01T08:00:00.000Z",
      },
      {
        id: "2",
        title: "Master Shifu Children Toy",
        price: "R 150",
        pricePrefix: "",
        condition: "Like New",
        category: "Other",
        seller: "Nayan",
        distance: "0 km",
        image_url: "",
        emoji: "Toy",
        rating: 0,
        reviewCount: 0,
        user_id: "user-xyz",
        description: "Barely used.",
        approximate_location: "Pretoria",
        institution: "UP",
        joined_year: 2023,
        created_at: "2026-03-01T08:00:00.000Z",
      },
    ]),
  CATEGORIES: [
    { label: "All Items", emoji: "All" },
    { label: "Textbooks", emoji: "Books" },
    { label: "Electronics", emoji: "Laptop" },
    { label: "Furniture", emoji: "Chair" },
    { label: "Clothing", emoji: "Shirt" },
    { label: "Sports", emoji: "Ball" },
    { label: "Instruments", emoji: "Guitar" },
    { label: "Stationery", emoji: "Pen" },
    { label: "Other", emoji: "Box" },
  ],
  CONDITIONS: ["All Conditions", "Like New", "Good", "Fair", "Poor"],
  CONDITION_COLORS: {
    "Like New": "#22c55e",
    Good: "#f59e0b",
    Fair: "#ef4444",
    Poor: "#6b7280",
  },
}));

function renderApp() {
  render(<App />);
}

function mockListingsScrollTargets(listingsHeading, filterBarTop = 120, listingsTop = 420) {
  const innerListingsSection = listingsHeading.closest("section");
  const listingsScrollSection = innerListingsSection?.parentElement;

  if (!innerListingsSection || !listingsScrollSection) {
    throw new Error("Could not find the listings scroll target");
  }

  const rect = {
    top: listingsTop,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: listingsTop,
    toJSON: () => ({}),
  };

  innerListingsSection.getBoundingClientRect = vi.fn(() => rect);
  listingsScrollSection.getBoundingClientRect = vi.fn(() => rect);

  return { filterBarTop, listingsTop };
}

test("renders the search bar with correct placeholder", async () => {
  renderApp();
  expect(
    await screen.findByPlaceholderText("Search textbooks, electronics, furniture...")
  ).toBeInTheDocument();
});

test("scrolls to the listings filter bar when the navbar search is focused", async () => {
  const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const filterBarTop = 120;

  renderApp();

  const searchInput = await screen.findByPlaceholderText(
    "Search textbooks, electronics, furniture..."
  );
  const filterBar = await screen.findByRole("navigation", { name: /categories/i });
  const listingsHeading = await screen.findByRole("heading", { name: /all items/i });
  mockListingsScrollTargets(listingsHeading);

  Object.defineProperty(window, "scrollY", {
    value: 40,
    writable: true,
    configurable: true,
  });

  filterBar.getBoundingClientRect = vi.fn(() => ({
    top: filterBarTop,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 68,
    x: 0,
    y: filterBarTop,
    toJSON: () => ({}),
  }));

  fireEvent.focus(searchInput);

  expect(scrollToSpy).toHaveBeenCalledWith({
    top: 328,
    behavior: "smooth",
  });

  scrollToSpy.mockRestore();
});

test("scrolls to the listings section when Start Browsing is clicked", async () => {
  const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const filterBarTop = 120;

  renderApp();

  const browseButton = await screen.findByRole("button", { name: /start browsing/i });
  const filterBar = await screen.findByRole("navigation", { name: /categories/i });
  const listingsHeading = await screen.findByRole("heading", { name: /all items/i });
  mockListingsScrollTargets(listingsHeading);

  Object.defineProperty(window, "scrollY", {
    value: 40,
    writable: true,
    configurable: true,
  });

  filterBar.getBoundingClientRect = vi.fn(() => ({
    top: filterBarTop,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 68,
    x: 0,
    y: filterBarTop,
    toJSON: () => ({}),
  }));

  fireEvent.click(browseButton);

  expect(scrollToSpy).toHaveBeenCalledWith({
    top: 328,
    behavior: "smooth",
  });

  scrollToSpy.mockRestore();
});

test("renders Log In and Sign Up Free buttons when logged out", async () => {
  renderApp();
  expect(await screen.findByRole("button", { name: /log in/i })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: /sign up free/i })).toBeInTheDocument();
});

test("does not render List Item or Messages when logged out", async () => {
  renderApp();
  await screen.findByRole("button", { name: /log in/i });
  expect(screen.queryByRole("button", { name: /list item/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /messages/i })).not.toBeInTheDocument();
});

test("renders category select with All Items as default", async () => {
  renderApp();
  const categorySelect = await screen.findByLabelText(/category/i);
  expect(categorySelect).toBeInTheDocument();
  expect(categorySelect.value).toBe("All Items");
});

test("renders condition select with All Conditions as default", async () => {
  renderApp();
  const conditionSelect = await screen.findByLabelText(/condition/i);
  expect(conditionSelect.value).toBe("All Conditions");
});

test("renders sort select with Any price as default", async () => {
  renderApp();
  const sortSelect = await screen.findByLabelText(/sort by/i);
  expect(sortSelect.value).toBe("");
});

test("shows custom price range inputs when Custom Price Range is selected", async () => {
  renderApp();
  const sortSelect = await screen.findByLabelText(/sort by/i);
  fireEvent.change(sortSelect, { target: { value: "custom" } });
  expect(await screen.findByLabelText(/minimum price/i)).toBeInTheDocument();
  expect(await screen.findByLabelText(/maximum price/i)).toBeInTheDocument();
});

test("shows Clear filters button when a filter is active", async () => {
  renderApp();
  const categorySelect = await screen.findByLabelText(/category/i);
  fireEvent.change(categorySelect, { target: { value: "Electronics" } });
  expect(await screen.findByRole("button", { name: /clear filters/i })).toBeInTheDocument();
});

test("renders listing cards from fetched data", async () => {
  renderApp();
  expect(await screen.findByRole("button", { name: /open details for sony ps5/i })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: /open details for master shifu children toy/i })).toBeInTheDocument();
});

test("renders price on listing card", async () => {
  renderApp();
  expect(await screen.findByText("R 10 999")).toBeInTheDocument();
});

test("renders condition badge on listing card", async () => {
  renderApp();
  expect(await screen.findByText("Good")).toBeInTheDocument();
});

test("renders seller name on listing card", async () => {
  renderApp();
  expect(await screen.findByText(/Saurav/)).toBeInTheDocument();
});

test("opens listing details modal when a listing card is clicked", async () => {
  renderApp();
  fireEvent.click(await screen.findByRole("button", { name: /open details for sony ps5/i }));

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /description/i })).toBeInTheDocument();
  });
});

test("modal shows login prompt when user is not logged in", async () => {
  renderApp();
  fireEvent.click(await screen.findByRole("button", { name: /open details for sony ps5/i }));
  const closeButton = await screen.findByRole("button", { name: /close item details/i });
  const modalContent = closeButton.closest(".item-modal-content");
  expect(
    within(modalContent).getByText(/to message this seller\./i, { selector: "p" })
  ).toBeInTheDocument();
});

test("modal shows seller info", async () => {
  renderApp();
  fireEvent.click(await screen.findByRole("button", { name: /open details for sony ps5/i }));
  const modal = await screen.findByRole("button", { name: /close item details/i });
  const modalContent = modal.closest(".item-modal-content");
  expect(within(modalContent).getByText(/seller:/i)).toBeInTheDocument();
  expect(within(modalContent).getByText(/institution:/i)).toBeInTheDocument();
  expect(within(modalContent).getByText(/Wits/)).toBeInTheDocument();
});

test("closes modal when close button is clicked", async () => {
  renderApp();
  fireEvent.click(await screen.findByRole("button", { name: /open details for sony ps5/i }));

  const closeBtn = await screen.findByRole("button", { name: /close item details/i });
  fireEvent.click(closeBtn);

  await waitFor(() => {
    expect(screen.queryByRole("heading", { name: /description/i })).not.toBeInTheDocument();
  });
});

test("filters listings by search query", async () => {
  renderApp();
  const input = await screen.findByPlaceholderText(
    "Search textbooks, electronics, furniture..."
  );

  fireEvent.change(input, { target: { value: "PS5" } });

  expect(await screen.findByRole("button", { name: /open details for sony ps5/i })).toBeInTheDocument();

  await waitFor(() => {
    expect(
      screen.queryByRole("button", { name: /open details for master shifu children toy/i })
    ).not.toBeInTheDocument();
  });
});

test("filters listings by category select", async () => {
  renderApp();
  const categorySelect = await screen.findByLabelText(/category/i);

  fireEvent.change(categorySelect, { target: { value: "Electronics" } });

  expect(await screen.findByRole("button", { name: /open details for sony ps5/i })).toBeInTheDocument();

  await waitFor(() => {
    expect(
      screen.queryByRole("button", { name: /open details for master shifu children toy/i })
    ).not.toBeInTheDocument();
  });
});

test("filters listings by condition select", async () => {
  renderApp();
  const conditionSelect = await screen.findByLabelText(/condition/i);

  fireEvent.change(conditionSelect, { target: { value: "Like New" } });

  expect(
    await screen.findByRole("button", { name: /open details for master shifu children toy/i })
  ).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByRole("button", { name: /open details for sony ps5/i })).not.toBeInTheDocument();
  });
});

test("clears active filters and restores all listings", async () => {
  renderApp();
  const categorySelect = await screen.findByLabelText(/category/i);

  fireEvent.change(categorySelect, { target: { value: "Electronics" } });
  fireEvent.click(await screen.findByRole("button", { name: /clear filters/i }));

  expect(categorySelect.value).toBe("All Items");
  expect(await screen.findByRole("button", { name: /open details for sony ps5/i })).toBeInTheDocument();
  expect(
    await screen.findByRole("button", { name: /open details for master shifu children toy/i })
  ).toBeInTheDocument();
});

test("sorts listings by price from high to low", async () => {
  renderApp();
  const sortSelect = await screen.findByLabelText(/sort by/i);

  fireEvent.change(sortSelect, { target: { value: "price_desc" } });

  const listingButtons = await screen.findAllByRole("button", { name: /open details for/i });
  expect(listingButtons[0]).toHaveAccessibleName(/open details for sony ps5/i);
  expect(listingButtons[1]).toHaveAccessibleName(/open details for master shifu children toy/i);
});

test("sorts listings by newest arrival", async () => {
  renderApp();
  const sortSelect = await screen.findByLabelText(/sort by/i);

  fireEvent.change(sortSelect, { target: { value: "newest" } });

  const listingButtons = await screen.findAllByRole("button", { name: /open details for/i });
  expect(listingButtons[0]).toHaveAccessibleName(/open details for master shifu children toy/i);
  expect(listingButtons[1]).toHaveAccessibleName(/open details for sony ps5/i);
});

test("filters listings by custom minimum price", async () => {
  renderApp();
  const sortSelect = await screen.findByLabelText(/sort by/i);

  fireEvent.change(sortSelect, { target: { value: "custom" } });
  fireEvent.change(await screen.findByLabelText(/minimum price/i), {
    target: { value: "1000" },
  });

  expect(await screen.findByRole("button", { name: /open details for sony ps5/i })).toBeInTheDocument();

  await waitFor(() => {
    expect(
      screen.queryByRole("button", { name: /open details for master shifu children toy/i })
    ).not.toBeInTheDocument();
  });
});

test("hides custom price inputs when switching back to any price", async () => {
  renderApp();
  const sortSelect = await screen.findByLabelText(/sort by/i);

  fireEvent.change(sortSelect, { target: { value: "custom" } });
  expect(await screen.findByLabelText(/minimum price/i)).toBeInTheDocument();

  fireEvent.change(sortSelect, { target: { value: "" } });

  await waitFor(() => {
    expect(screen.queryByLabelText(/minimum price/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/maximum price/i)).not.toBeInTheDocument();
  });
});

test("shows empty listings state when no results match the search", async () => {
  renderApp();
  const input = await screen.findByPlaceholderText(
    "Search textbooks, electronics, furniture..."
  );

  fireEvent.change(input, { target: { value: "not-a-real-item" } });

  expect(await screen.findByRole("heading", { name: /results for "not-a-real-item"/i })).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: /no listings yet/i })).toBeInTheDocument();
});

test("cycles listing modal images with carousel controls", async () => {
  renderApp();
  fireEvent.click(await screen.findByRole("button", { name: /open details for sony ps5/i }));

  const closeButton = await screen.findByRole("button", { name: /close item details/i });
  const modalContent = closeButton.closest(".item-modal-content");
  const image = within(modalContent).getByAltText(/sony ps5/i);
  expect(image).toHaveAttribute("src", "/ps5-1.jpg");

  fireEvent.click(await screen.findByRole("button", { name: /show next image/i }));
  expect(image).toHaveAttribute("src", "/ps5-2.jpg");

  fireEvent.click(await screen.findByRole("button", { name: /show previous image/i }));
  expect(image).toHaveAttribute("src", "/ps5-1.jpg");
});

test("closes modal when Escape is pressed", async () => {
  renderApp();
  fireEvent.click(await screen.findByRole("button", { name: /open details for sony ps5/i }));
  expect(await screen.findByRole("heading", { name: /description/i })).toBeInTheDocument();

  fireEvent.keyDown(window, { key: "Escape" });

  await waitFor(() => {
    expect(screen.queryByRole("heading", { name: /description/i })).not.toBeInTheDocument();
  });
});

test("navigates to login and signup pages from logged-out actions", async () => {
  renderApp();

  fireEvent.click(await screen.findByRole("button", { name: /log in/i }));
  expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /sign up free/i }));
  expect(await screen.findByRole("heading", { name: /create your account/i })).toBeInTheDocument();
});

test("returns to the home hero when the browser goes back from signup", async () => {
  renderApp();

  fireEvent.click(await screen.findByRole("button", { name: /start listing/i }));
  expect(await screen.findByRole("heading", { name: /create your account/i })).toBeInTheDocument();

  window.history.back();

  await waitFor(() => {
    expect(screen.getByRole("region", { name: /hero/i })).toBeInTheDocument();
  });
});
