import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sandbox = Deno.env.get("PAYFAST_SANDBOX") !== "false";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase service role is not configured." }, 500);
  }
  if (!sandbox) {
    return jsonResponse({ error: "Return confirmation is only available in PayFast sandbox mode." }, 403);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();

  if (authError || !authData.user) {
    return jsonResponse({ error: "Sign in before confirming payment." }, 401);
  }

  const { transactionId } = await req.json().catch(() => ({ transactionId: "" }));
  if (!transactionId) {
    return jsonResponse({ error: "Missing transactionId." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: transaction, error } = await supabase
    .from("transactions")
    .select("id, listing_id, buyer_id, price, status, payment_status, payment_method, transaction_type")
    .eq("id", transactionId)
    .single();

  if (error || !transaction) {
    return jsonResponse({ error: "Transaction not found." }, 404);
  }
  if (transaction.buyer_id !== authData.user.id) {
    return jsonResponse({ error: "Only the buyer can confirm this sandbox payment." }, 403);
  }
  if (transaction.transaction_type === "item_trade") {
    return jsonResponse({ error: "Item trades do not use PayFast payments." }, 400);
  }
  if (transaction.payment_status === "paid") {
    return jsonResponse({ ok: true, alreadyPaid: true });
  }
  if (!String(transaction.payment_method || "").includes("payfast")) {
    return jsonResponse({ error: "This transaction is not a PayFast sandbox payment." }, 400);
  }

  const paidAt = new Date().toISOString();
  const reference = `SANDBOX-RETURN-${transaction.id}`;

  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      status: "awaiting_dropoff",
      payment_status: "paid",
      payment_provider: "payfast",
      payment_method: "payfast_sandbox",
      paid_at: paidAt,
      payfast_payment_reference: reference,
    })
    .eq("id", transaction.id);

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  if (transaction.listing_id) {
    await supabase
      .from("listings")
      .update({
        status: "sold",
        sold_price: transaction.price,
      })
      .eq("id", transaction.listing_id);
  }

  return jsonResponse({ ok: true, transactionId: transaction.id });
});
