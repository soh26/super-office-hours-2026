import { getSponsorBySlug } from "../lib/supabase.js";

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

  const slug = String(body.slug || "").trim().toLowerCase();
  const email = String(body.email || "").trim();
  const name = String(body.name || "").trim();

  if (!slug) return json({ error: "Sponsor slug is required" }, 400);
  if (!email) return json({ error: "Contact email is required" }, 400);

  // Lookup sponsor
  let sponsor = await getSponsorBySlug(context.env, slug);
  // If Supabase is not configured or in fallback mode, allow payload fallback if amount is valid
  if (!sponsor) {
    if (body.sponsorName && Number(body.amount) > 0) {
      sponsor = {
        id: body.id || crypto.randomUUID(),
        name: body.sponsorName,
        slug,
        amount: Number(body.amount),
        description: body.description || "",
        status: "pending",
      };
    } else {
      return json({ error: "Sponsorship link not found" }, 404);
    }
  }

  if (sponsor.status === "paid") {
    return json({ error: "This sponsorship package has already been paid" }, 400);
  }

  const origin = new URL(context.request.url).origin;
  const description = body.description || sponsor.description || "Super Office Hours Partnership & Sponsorship";

  const formParams = {
    mode: "payment",
    customer_email: email,
    success_url: `${origin}/thanks-${sponsor.slug}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/thanks-${sponsor.slug}?canceled=1`,
    "metadata[type]": "sponsor",
    "metadata[sponsor_id]": sponsor.id || "",
    "metadata[sponsor_slug]": sponsor.slug,
    "metadata[sponsor_name]": sponsor.name,
    "metadata[description]": description,
    "metadata[name]": name,
    "metadata[email]": email,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "jpy",
    "line_items[0][price_data][unit_amount]": String(sponsor.amount),
    "line_items[0][price_data][product_data][name]": `${sponsor.name} — Super Office Hours Sponsorship`,
  };

  if (description) {
    formParams["line_items[0][price_data][product_data][description]"] = description;
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(formParams).toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    return json({ error: data.error?.message || "Stripe error" }, 500);
  }

  return json({ url: data.url });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
