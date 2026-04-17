import { beforeEach, expect, test, vi } from "vitest";
import { insertMessage } from "./messageDelivery";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("../supabaseClient", () => ({
  supabase: {
    from: mocks.from,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ insert: mocks.insert });
});

test("insertMessage retries without listing metadata when Supabase rejects it", async () => {
  const schemaError = { message: "Could not find the 'listing_id' column in the schema cache" };
  mocks.insert
    .mockResolvedValueOnce({ data: null, error: schemaError })
    .mockResolvedValueOnce({ data: null, error: null });

  const result = await insertMessage({
    sender_id: "user-1",
    receiver_id: "seller-1",
    content: "Is this still available?",
    listing_id: "listing-1",
  });

  expect(result.error).toBeNull();
  expect(mocks.insert).toHaveBeenNthCalledWith(1, {
    sender_id: "user-1",
    receiver_id: "seller-1",
    content: "Is this still available?",
    listing_id: "listing-1",
  });
  expect(mocks.insert).toHaveBeenNthCalledWith(2, {
    sender_id: "user-1",
    receiver_id: "seller-1",
    content: "Is this still available?",
  });
});
