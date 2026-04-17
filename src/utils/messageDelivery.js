import { supabase } from "../supabaseClient";

function removeEmptyOptionalFields(payload) {
  const next = { ...payload };

  if (next.listing_id == null || next.listing_id === "") {
    delete next.listing_id;
  }

  return next;
}

export async function insertMessage(payload) {
  const messagePayload = removeEmptyOptionalFields(payload);
  const result = await supabase.from("messages").insert(messagePayload);

  if (!result.error || !("listing_id" in messagePayload)) {
    return result;
  }

  const { listing_id, ...messageWithoutListing } = messagePayload;
  const retryResult = await supabase.from("messages").insert(messageWithoutListing);

  if (!retryResult.error) {
    console.warn(
      "Message sent without listing_id because Supabase rejected the listing metadata.",
      result.error.message
    );
  }

  return retryResult;
}
