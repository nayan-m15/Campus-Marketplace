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

async function sendBrevoPaymentEmail({
  toEmail,
  toName,
  item,
  amount,
  transactionId,
}: {
  toEmail: string;
  toName?: string;
  item: string;
  amount: number;
  transactionId: string;
}) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const fromEmail = Deno.env.get("BREVO_FROM_EMAIL");
  const fromName = Deno.env.get("BREVO_FROM_NAME") || "CampusXchange";
  const formattedAmount = `R ${Number(amount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const safeItem = item || "CampusXchange item";
  const bookingsUrl = `${(Deno.env.get("APP_BASE_URL") || "").replace(/\/$/, "")}/bookings`;

  if (!apiKey || !fromEmail || !toEmail) {
    console.warn("Brevo payment email skipped", {
      hasApiKey: Boolean(apiKey),
      hasFromEmail: Boolean(fromEmail),
      hasToEmail: Boolean(toEmail),
    });
    return;
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: [{ email: toEmail, name: toName || toEmail }],
      subject: "Payment confirmed - CampusXchange",
      htmlContent: `
        <div style="margin:0;padding:32px 16px;background:#e3efe6;font-family:Arial,Helvetica,sans-serif;color:#10261a;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px rgba(15,23,42,0.12);">
            <tr><td style="padding:30px 28px;text-align:center;background:#116b55;"><div style="font-size:24px;font-weight:800;color:#ffffff;">CampusXchange</div><div style="display:inline-block;margin-top:14px;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,0.16);color:#dff7e8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Payment Confirmation</div></td></tr>
            <tr><td style="padding:34px 30px 18px;text-align:center;"><div style="width:58px;height:58px;line-height:58px;margin:0 auto 16px;border-radius:50%;background:#dcfce7;color:#166534;font-size:32px;font-weight:800;">✓</div><h1 style="margin:0 0 10px;font-size:26px;color:#10261a;">Payment Successful</h1><p style="margin:0;color:#4b6356;font-size:15px;line-height:1.6;">Your PayFast sandbox payment for <strong>${safeItem}</strong> has been confirmed.</p></td></tr>
            <tr><td style="padding:12px 30px 4px;text-align:center;"><div style="display:inline-block;padding:20px 26px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;"><div style="font-size:34px;line-height:1;font-weight:800;color:#116b55;">${formattedAmount}</div><div style="margin-top:10px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Transaction ID</div><div style="margin-top:4px;color:#10261a;font-size:14px;font-weight:700;">${transactionId}</div></div></td></tr>
            <tr><td style="padding:24px 30px 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;"><tr><td style="padding:13px 16px;background:#f8fafc;color:#64748b;font-size:13px;font-weight:700;">Item</td><td style="padding:13px 16px;background:#f8fafc;color:#10261a;font-size:13px;text-align:right;font-weight:700;">${safeItem}</td></tr><tr><td style="padding:13px 16px;color:#64748b;font-size:13px;font-weight:700;border-top:1px solid #e2e8f0;">Amount</td><td style="padding:13px 16px;color:#10261a;font-size:13px;text-align:right;font-weight:700;border-top:1px solid #e2e8f0;">${formattedAmount}</td></tr><tr><td style="padding:13px 16px;background:#f8fafc;color:#64748b;font-size:13px;font-weight:700;border-top:1px solid #e2e8f0;">Payment Method</td><td style="padding:13px 16px;background:#f8fafc;color:#10261a;font-size:13px;text-align:right;font-weight:700;border-top:1px solid #e2e8f0;">PayFast Sandbox</td></tr><tr><td style="padding:13px 16px;color:#64748b;font-size:13px;font-weight:700;border-top:1px solid #e2e8f0;">Status</td><td style="padding:13px 16px;color:#166534;font-size:13px;text-align:right;font-weight:800;border-top:1px solid #e2e8f0;">Confirmed</td></tr><tr><td style="padding:13px 16px;background:#f8fafc;color:#64748b;font-size:13px;font-weight:700;border-top:1px solid #e2e8f0;">Transaction ID</td><td style="padding:13px 16px;background:#f8fafc;color:#10261a;font-size:13px;text-align:right;font-weight:700;border-top:1px solid #e2e8f0;">${transactionId}</td></tr></table></td></tr>
            <tr><td style="padding:18px 30px 34px;text-align:center;"><p style="margin:0 0 18px;color:#4b6356;font-size:14px;line-height:1.6;">You can now book your collection slot in My Bookings.</p><a href="${bookingsUrl}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:#116b55;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;">Go to My Bookings</a><p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.5;">This was a sandbox/demo payment. No real money was transferred.</p></td></tr>
          </table>
        </div>
      `,
      textContent: `Payment successful. Item: ${safeItem}. Amount: ${formattedAmount}. Payment Method: PayFast Sandbox. Status: Confirmed. Transaction ID: ${transactionId}. You can now book collection in My Bookings: ${bookingsUrl}. This was a sandbox/demo payment.`,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error("Brevo payment email failed", response.status, responseText);
    return;
  }
  console.log("Brevo payment email sent", responseText);
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
    .select("id, item, listing_id, buyer_id, price, status, payment_status, payment_method, transaction_type")
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
    await sendBrevoPaymentEmail({
      toEmail: authData.user.email || "",
      toName: String(authData.user.user_metadata?.display_name || authData.user.user_metadata?.name || ""),
      item: transaction.item || "CampusXchange item",
      amount: Number(transaction.price || 0),
      transactionId: transaction.id,
    });
    return jsonResponse({ ok: true, alreadyPaid: true, emailAttempted: true });
  }
  if (transaction.payment_status !== "pending") {
    return jsonResponse({ error: "Start PayFast checkout before confirming this sandbox payment." }, 409);
  }
  if (transaction.status !== "item_received") {
    return jsonResponse({ error: "Payment can only be confirmed after facility staff receives the item." }, 409);
  }
  if (!String(transaction.payment_method || "").includes("payfast")) {
    return jsonResponse({ error: "This transaction is not a PayFast sandbox payment." }, 400);
  }

  const paidAt = new Date().toISOString();
  const reference = `SANDBOX-RETURN-${transaction.id}`;

  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      status: "awaiting_collection",
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

  await sendBrevoPaymentEmail({
    toEmail: authData.user.email || "",
    toName: String(authData.user.user_metadata?.display_name || authData.user.user_metadata?.name || ""),
    item: transaction.item || "CampusXchange item",
    amount: Number(transaction.price || 0),
    transactionId: transaction.id,
  });

  return jsonResponse({ ok: true, transactionId: transaction.id });
});
