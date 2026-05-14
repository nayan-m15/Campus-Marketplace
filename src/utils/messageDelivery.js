import { supabase } from "../supabaseClient";

/*This function removes the empty optional fields.*/
function removeEmptyOptionalFields(payload) {
  const next = { ...payload };

  if (next.listing_id == null || next.listing_id === "") {
    delete next.listing_id;
  }

  return next;
}

/*This function inserts the message.*/
export async function insertMessage(payload) {
  const messagePayload = removeEmptyOptionalFields(payload);
  return supabase.from("messages").insert(messagePayload);
}
