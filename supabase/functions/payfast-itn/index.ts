import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function encodePayfastValue(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function md5(input: string) {
  function rotateLeft(value: number, amount: number) {
    return (value << amount) | (value >>> (32 - amount));
  }

  function addUnsigned(a: number, b: number) {
    const lsw = (a & 0xffff) + (b & 0xffff);
    const msw = (a >>> 16) + (b >>> 16) + (lsw >>> 16);
    return (msw << 16) | (lsw & 0xffff);
  }

  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    return addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, q), addUnsigned(x, t)), s), b);
  }

  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }

  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }

  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  const bytes = new TextEncoder().encode(input);
  const bitLength = bytes.length * 8;
  const words = new Array((((bytes.length + 8) >>> 6) + 1) * 16).fill(0);

  for (let i = 0; i < bytes.length; i += 1) {
    words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  }
  words[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
  words[words.length - 2] = bitLength & 0xffffffff;
  words[words.length - 1] = Math.floor(bitLength / 0x100000000);

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let i = 0; i < words.length; i += 16) {
    const oldA = a;
    const oldB = b;
    const oldC = c;
    const oldD = d;

    a = ff(a, b, c, d, words[i], 7, 0xd76aa478);
    d = ff(d, a, b, c, words[i + 1], 12, 0xe8c7b756);
    c = ff(c, d, a, b, words[i + 2], 17, 0x242070db);
    b = ff(b, c, d, a, words[i + 3], 22, 0xc1bdceee);
    a = ff(a, b, c, d, words[i + 4], 7, 0xf57c0faf);
    d = ff(d, a, b, c, words[i + 5], 12, 0x4787c62a);
    c = ff(c, d, a, b, words[i + 6], 17, 0xa8304613);
    b = ff(b, c, d, a, words[i + 7], 22, 0xfd469501);
    a = ff(a, b, c, d, words[i + 8], 7, 0x698098d8);
    d = ff(d, a, b, c, words[i + 9], 12, 0x8b44f7af);
    c = ff(c, d, a, b, words[i + 10], 17, 0xffff5bb1);
    b = ff(b, c, d, a, words[i + 11], 22, 0x895cd7be);
    a = ff(a, b, c, d, words[i + 12], 7, 0x6b901122);
    d = ff(d, a, b, c, words[i + 13], 12, 0xfd987193);
    c = ff(c, d, a, b, words[i + 14], 17, 0xa679438e);
    b = ff(b, c, d, a, words[i + 15], 22, 0x49b40821);

    a = gg(a, b, c, d, words[i + 1], 5, 0xf61e2562);
    d = gg(d, a, b, c, words[i + 6], 9, 0xc040b340);
    c = gg(c, d, a, b, words[i + 11], 14, 0x265e5a51);
    b = gg(b, c, d, a, words[i], 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, words[i + 5], 5, 0xd62f105d);
    d = gg(d, a, b, c, words[i + 10], 9, 0x02441453);
    c = gg(c, d, a, b, words[i + 15], 14, 0xd8a1e681);
    b = gg(b, c, d, a, words[i + 4], 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, words[i + 9], 5, 0x21e1cde6);
    d = gg(d, a, b, c, words[i + 14], 9, 0xc33707d6);
    c = gg(c, d, a, b, words[i + 3], 14, 0xf4d50d87);
    b = gg(b, c, d, a, words[i + 8], 20, 0x455a14ed);
    a = gg(a, b, c, d, words[i + 13], 5, 0xa9e3e905);
    d = gg(d, a, b, c, words[i + 2], 9, 0xfcefa3f8);
    c = gg(c, d, a, b, words[i + 7], 14, 0x676f02d9);
    b = gg(b, c, d, a, words[i + 12], 20, 0x8d2a4c8a);

    a = hh(a, b, c, d, words[i + 5], 4, 0xfffa3942);
    d = hh(d, a, b, c, words[i + 8], 11, 0x8771f681);
    c = hh(c, d, a, b, words[i + 11], 16, 0x6d9d6122);
    b = hh(b, c, d, a, words[i + 14], 23, 0xfde5380c);
    a = hh(a, b, c, d, words[i + 1], 4, 0xa4beea44);
    d = hh(d, a, b, c, words[i + 4], 11, 0x4bdecfa9);
    c = hh(c, d, a, b, words[i + 7], 16, 0xf6bb4b60);
    b = hh(b, c, d, a, words[i + 10], 23, 0xbebfbc70);
    a = hh(a, b, c, d, words[i + 13], 4, 0x289b7ec6);
    d = hh(d, a, b, c, words[i], 11, 0xeaa127fa);
    c = hh(c, d, a, b, words[i + 3], 16, 0xd4ef3085);
    b = hh(b, c, d, a, words[i + 6], 23, 0x04881d05);
    a = hh(a, b, c, d, words[i + 9], 4, 0xd9d4d039);
    d = hh(d, a, b, c, words[i + 12], 11, 0xe6db99e5);
    c = hh(c, d, a, b, words[i + 15], 16, 0x1fa27cf8);
    b = hh(b, c, d, a, words[i + 2], 23, 0xc4ac5665);

    a = ii(a, b, c, d, words[i], 6, 0xf4292244);
    d = ii(d, a, b, c, words[i + 7], 10, 0x432aff97);
    c = ii(c, d, a, b, words[i + 14], 15, 0xab9423a7);
    b = ii(b, c, d, a, words[i + 5], 21, 0xfc93a039);
    a = ii(a, b, c, d, words[i + 12], 6, 0x655b59c3);
    d = ii(d, a, b, c, words[i + 3], 10, 0x8f0ccc92);
    c = ii(c, d, a, b, words[i + 10], 15, 0xffeff47d);
    b = ii(b, c, d, a, words[i + 1], 21, 0x85845dd1);
    a = ii(a, b, c, d, words[i + 8], 6, 0x6fa87e4f);
    d = ii(d, a, b, c, words[i + 15], 10, 0xfe2ce6e0);
    c = ii(c, d, a, b, words[i + 6], 15, 0xa3014314);
    b = ii(b, c, d, a, words[i + 13], 21, 0x4e0811a1);
    a = ii(a, b, c, d, words[i + 4], 6, 0xf7537e82);
    d = ii(d, a, b, c, words[i + 11], 10, 0xbd3af235);
    c = ii(c, d, a, b, words[i + 2], 15, 0x2ad7d2bb);
    b = ii(b, c, d, a, words[i + 9], 21, 0xeb86d391);

    a = addUnsigned(a, oldA);
    b = addUnsigned(b, oldB);
    c = addUnsigned(c, oldC);
    d = addUnsigned(d, oldD);
  }

  return [a, b, c, d]
    .flatMap((value) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff])
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildSignature(fields: Record<string, string>, passphrase = "") {
  const pairs = Object.entries(fields)
    .filter(([key, value]) => key !== "signature" && value !== "")
    .map(([key, value]) => `${key}=${encodePayfastValue(value.trim())}`);

  if (passphrase) {
    pairs.push(`passphrase=${encodePayfastValue(passphrase.trim())}`);
  }

  return md5(pairs.join("&"));
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
  const expectedSignature = buildSignature(payload, passphrase);

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
