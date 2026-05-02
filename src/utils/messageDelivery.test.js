import { expect, test, vi } from "vitest";
import { insertMessage } from "./messageDelivery";
import { supabase } from "../supabaseClient";

vi.mock("../supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

test("insertMessage keeps listing_id on listing-scoped messages when insert fails", async () => {
  const insert = vi.fn(() => Promise.resolve({ error: { message: "Rejected" } }));
  supabase.from.mockReturnValue({ insert });

  const result = await insertMessage({
    sender_id: "user-1",
    receiver_id: "seller-1",
    content: "Hello",
    listing_id: "listing-2",
  });

  expect(supabase.from).toHaveBeenCalledTimes(1);
  expect(supabase.from).toHaveBeenCalledWith("messages");
  expect(insert).toHaveBeenCalledTimes(1);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ listing_id: "listing-2" }));
  expect(result.error.message).toBe("Rejected");
});
