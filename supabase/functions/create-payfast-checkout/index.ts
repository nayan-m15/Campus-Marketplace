import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYFAST_SANDBOX_URL = "https://sandbox.payfast.co.za/eng/process";
const PAYFAST_LIVE_URL = "https://www.payfast.co.za/eng/process";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function encodePayfastValue(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function buildSignature(fields: Record<string, string>, passphrase = "") {
  const pairs = Object.entries(fields)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${key}=${encodePayfastValue(value.trim())}`);

  if (passphrase) {
    pairs.push(`passphrase=${encodePayfastValue(passphrase.trim())}`);
  }

  return crypto.subtle.digest(
    "MD5",
    new TextEncoder().encode(pairs.join("&")),
  ).then((buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  );
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
  const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID");
  const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY");
  const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";
  const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:5173";
  const functionBaseUrl = Deno.env.get("PAYFAST_NOTIFY_BASE_URL");
  const sandbox = Deno.env.get("PAYFAST_SANDBOX") !== "false";

  if (!supabaseUrl || !serviceRoleKey || !merchantId || !merchantKey) {
    return jsonResponse({ error: "PayFast sandbox is not configured." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();

  if (authError || !authData.user) {
    return jsonResponse({ error: "Sign in before starting payment." }, 401);
  }

  const { transactionId } = await req.json().catch(() => ({ transactionId: "" }));
  if (!transactionId) {
    return jsonResponse({ error: "Missing transactionId." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: transaction, error } = await adminClient
    .from("transactions")
    .select("id, item, seller_id, buyer_id, price, status, payment_status, transaction_type, payfast_payment_reference")
    .eq("id", transactionId)
    .single();

  if (error || !transaction) {
    return jsonResponse({ error: "Transaction not found." }, 404);
  }
  if (transaction.buyer_id !== authData.user.id) {
    return jsonResponse({ error: "Only the buyer can pay for this transaction." }, 403);
  }
  if (transaction.transaction_type === "item_trade") {
    return jsonResponse({ error: "Item trades do not use PayFast payments." }, 400);
  }
  if (transaction.payment_status === "paid") {
    return jsonResponse({ error: "This transaction is already paid." }, 409);
  }

  const amount = Number(transaction.price || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse({ error: "Transaction has an invalid amount." }, 400);
  }

  const notifyBase = functionBaseUrl || `${supabaseUrl}/functions/v1`;
  const paymentReference = transaction.payfast_payment_reference || transaction.id;
  const fields: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${appBaseUrl.replace(/\/$/, "")}/bookings?payment=success`,
    cancel_url: `${appBaseUrl.replace(/\/$/, "")}/bookings?payment=cancelled`,
    notify_url: `${notifyBase.replace(/\/$/, "")}/payfast-itn`,
    m_payment_id: paymentReference,
    amount: amount.toFixed(2),
    item_name: String(transaction.item || "CampusXchange item").slice(0, 100),
    item_description: `CampusXchange sandbox payment for ${transaction.id}`.slice(0, 255),
    custom_str1: transaction.id,
    custom_str2: "campusxchange-payfast-sandbox",
  };
  const signature = await buildSignature(fields, passphrase);

  const { error: updateError } = await adminClient
    .from("transactions")
    .update({
      payment_status: "pending",
      payment_provider: "payfast",
      payment_method: sandbox ? "payfast_sandbox" : "payfast",
      payfast_payment_reference: paymentReference,
    })
    .eq("id", transaction.id);

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  return jsonResponse({
    action: sandbox ? PAYFAST_SANDBOX_URL : PAYFAST_LIVE_URL,
    fields: { ...fields, signature },
  });
});
