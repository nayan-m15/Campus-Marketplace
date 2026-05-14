import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function encodePayfastValue(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

async function buildSignature(fields: Record<string, string>, passphrase = "") {
  const pairs = Object.entries(fields)
    .filter(([key, value]) => key !== "signature" && value !== "")
    .map(([key, value]) => `${key}=${encodePayfastValue(value.trim())}`);

  if (passphrase) {
    pairs.push(`passphrase=${encodePayfastValue(passphrase.trim())}`);
  }

  const buffer = await crypto.subtle.digest(
    "MD5",
    new TextEncoder().encode(pairs.join("&")),
  );

  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseForm(body: string) {
  const params = new URLSearchParams(body);
  return Object.fromEntries([...params.entries()]);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID");
  const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";

  if (!supabaseUrl || !serviceRoleKey || !merchantId) {
    return new Response("PayFast not configured", { status: 500 });
  }

  const payload = parseForm(await req.text());
  const expectedSignature = await buildSignature(payload, passphrase);

  if (payload.signature !== expectedSignature) {
    return new Response("Invalid signature", { status: 400 });
  }
  if (payload.merchant_id && payload.merchant_id !== merchantId) {
    return new Response("Invalid merchant", { status: 400 });
  }

  const transactionId = payload.custom_str1 || payload.m_payment_id;
  if (!transactionId) {
    return new Response("Missing transaction reference", { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: transaction, error } = await supabase
    .from("transactions")
    .select("id, listing_id, price, payment_status, transaction_type")
    .eq("id", transactionId)
    .single();

  if (error || !transaction) {
    return new Response("Transaction not found", { status: 404 });
  }

  const expectedAmount = Number(transaction.price || 0).toFixed(2);
  const receivedAmount = Number(payload.amount_gross || payload.amount || 0).toFixed(2);
  if (expectedAmount !== receivedAmount) {
    return new Response("Amount mismatch", { status: 400 });
  }

  if (String(payload.payment_status || "").toUpperCase() !== "COMPLETE") {
    await supabase
      .from("transactions")
      .update({ payment_status: "failed" })
      .eq("id", transaction.id);
    return new Response("Payment not complete", { status: 200 });
  }

  await supabase
    .from("transactions")
    .update({
      status: "awaiting_dropoff",
      payment_status: "paid",
      payment_provider: "payfast",
      payment_method: Deno.env.get("PAYFAST_SANDBOX") === "false" ? "payfast" : "payfast_sandbox",
      paid_at: new Date().toISOString(),
      payfast_payment_id: payload.pf_payment_id || null,
      payfast_payment_reference: payload.m_payment_id || transaction.id,
    })
    .eq("id", transaction.id);

  if (transaction.listing_id) {
    await supabase
      .from("listings")
      .update({
        status: "sold",
        sold_price: transaction.price,
      })
      .eq("id", transaction.listing_id);
  }

  return new Response("OK", { status: 200 });
});
