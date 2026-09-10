import { createPendingRegistration } from "../lib/supabase.js";

const PRICES = {
  test_taro: { amount: 50, name: "Taro ticket" },
  startup: { amount: 2500, name: "Startup ticket" },
  investor: { amount: 5000, name: "Investor ticket" },
  lpDinner: { amount: 25000, name: "LP Dinner (Sep 24)" },
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function onRequestPost(context) {
  const secret = context.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return json({ error: "STRIPE_SECRET_KEY is not set in Cloudflare" }, 500);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const qty = body.qty || {};
  const email = String(body.email || "").trim();
  const name = String(body.name || "").trim();
  const company = String(body.company || "").trim();
  const role = String(body.role || "").trim();
  const questionnaire = body.questionnaire || {};
  const registrationId = body.registrationId || crypto.randomUUID();
  const lpDinner = Boolean(body.lpDinner);

  if (!email) return json({ error: "Email required" }, 400);

  const isDebug =
    context.env.DEBUG === "true" ||
    context.env.ENABLE_TEST_TICKETS === "true" ||
    secret.startsWith("sk_test_");

  if (!isDebug && Number(qty.test_taro || 0) > 0) {
    return json({ error: "Test tickets are disabled in production" }, 400);
  }

  const allowedKeys = isDebug ? ["test_taro", "startup", "investor"] : ["startup", "investor"];

  let totalAmount = 0;
  const line_items = [];
  for (const key of allowedKeys) {
    const count = Number(qty[key] || 0);
    if (count > 0) {
      const itemAmount = PRICES[key].amount;
      totalAmount += count * itemAmount;
      line_items.push({
        quantity: count,
        price_data: {
          currency: "jpy",
          unit_amount: itemAmount,
          product_data: { name: PRICES[key].name },
        },
      });
    }
  }
  if (lpDinner && Number(qty.investor || 0) > 0) {
    totalAmount += PRICES.lpDinner.amount;
    line_items.push({
      quantity: 1,
      price_data: {
        currency: "jpy",
        unit_amount: PRICES.lpDinner.amount,
        product_data: { name: PRICES.lpDinner.name },
      },
    });
  }
  if (!line_items.length) return json({ error: "No tickets selected" }, 400);

  // Attempt to create a pending registration record in Supabase (if configured)
  await createPendingRegistration(context.env, {
    id: registrationId,
    name,
    email,
    company,
    role,
    tickets: qty,
    totalAmount,
    questionnaire,
    userAgent: context.request.headers.get("user-agent"),
    referrer: context.request.headers.get("referer"),
  });

  const origin = new URL(context.request.url).origin;

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm({
      mode: "payment",
      customer_email: email,
      success_url: `${origin}/?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=1`,
      "metadata[registration_id]": registrationId,
      "metadata[name]": name,
      "metadata[company]": company,
      "metadata[role]": role,
      "metadata[email]": email,
      ...flattenLineItems(line_items),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return json({ error: data.error?.message || "Stripe error" }, 500);
  }
  return json({ url: data.url });
}

function flattenLineItems(items) {
  const out = {};
  items.forEach((item, i) => {
    out[`line_items[${i}][quantity]`] = item.quantity;
    out[`line_items[${i}][price_data][currency]`] = item.price_data.currency;
    out[`line_items[${i}][price_data][unit_amount]`] = item.price_data.unit_amount;
    out[`line_items[${i}][price_data][product_data][name]`] =
      item.price_data.product_data.name;
  });
  return out;
}

function encodeForm(obj) {
  return new URLSearchParams(
    Object.entries(obj).map(([k, v]) => [k, String(v)])
  ).toString();
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
} 
