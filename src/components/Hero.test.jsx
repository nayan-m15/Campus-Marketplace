import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeEach, expect, test } from "vitest";
import Hero from "./Hero";
import { fetchListings } from "../data/listings";

vi.mock("../data/listings", () => ({
  CONDITION_COLORS: {
    Good: "#E59D3A",
    New: "#1F6B52",
  },
  fetchListings: vi.fn(),
}));

function makeListingsQuery(result) {
  const query = {
    ...result,
    neq: () => query,
    eq: () => query,
    gte: () => query,
  };

  return query;
}

vi.mock("../supabaseClient", () => ({
  supabase: {
    from: (table) => ({
      select: (columns, options) => {
        if (table === "profiles") {
          return { count: 12, error: null };
        }

        if (table === "listings" && options?.head) {
          return makeListingsQuery({ count: 2, error: null });
        }

        return makeListingsQuery({ data: [], error: null });
      },
    }),
  },
}));

const listings = [
  {
    id: "listing-1",
    title: "Desk Lamp",
    price: "R 250",
    condition: "Good",
    category: "Electronics",
    seller: "Amina",
    image_url: "",
    emoji: "Lamp",
  },
  {
    id: "listing-2",
    title: "Calculus Textbook",
    price: "R 320",
    condition: "New",
    category: "Textbooks",
    seller: "Noah",
    image_url: "",
    emoji: "Book",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  fetchListings.mockResolvedValue(listings);
});

test("opens hero listing details from the whole slide while carousel controls only navigate", async () => {
  const onListingClick = vi.fn();

  const { container } = render(
    <Hero
      onListingClick={onListingClick}
      onBrowseClick={vi.fn()}
      onSignupClick={vi.fn()}
      onLoginClick={vi.fn()}
      user={{ id: "user-1" }}
    />
  );

  const firstSlide = await screen.findByRole("button", {
    name: /open details for desk lamp/i,
  });
  const track = container.querySelector(".carousel-track");

  fireEvent.click(screen.getByRole("button", { name: /next slide/i }));
  expect(onListingClick).not.toHaveBeenCalled();
  expect(track).toHaveStyle({ transform: "translateX(-100%)" });

  await waitFor(() => {
    expect(screen.getByRole("button", {
      name: /open details for calculus textbook/i,
    })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: /go to slide 1/i }));
  expect(onListingClick).not.toHaveBeenCalled();
  expect(track).toHaveStyle({ transform: "translateX(-0%)" });

  fireEvent.click(firstSlide);
  expect(onListingClick).toHaveBeenCalledWith(listings[0]);
});
