import { supabase } from "../supabaseClient";

/*This function removes optional message fields that should not be sent when they are empty.*/
function removeEmptyOptionalFields(payload) {
  const next = { ...payload };

  if (next.listing_id == null || next.listing_id === "") {
    delete next.listing_id;
  }

  return next;
}

/*This function inserts a new message after cleaning optional fields from the payload.*/
export async function insertMessage(payload) {
  const messagePayload = removeEmptyOptionalFields(payload);
  return supabase.from("messages").insert(messagePayload);
}
