import { createSponsor, getSponsorBySlug, listSponsors } from "../../lib/supabase.js";

function checkAdminAuth(context) {
  const adminPassword = (
    context.env.SPONSOR_ADMIN_PASSWORD ||
    context.env.ADMIN_PASSWORD ||
    ""
  ).trim();

  if (!adminPassword) {
    return { error: "SPONSOR_ADMIN_PASSWORD is not configured in server environment", status: 500 };
  }

  const authHeader = context.request.headers.get("Authorization") || "";
  const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const customHeader = context.request.headers.get("X-Admin-Password") || "";
  const password = headerToken || customHeader;

  if (!password || password !== adminPassword) {
    return { error: "Unauthorized: Invalid admin password", status: 401 };
  }

  return null;
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function onRequestGet(context) {
  const authErr = checkAdminAuth(context);
  if (authErr) return json({ error: authErr.error }, authErr.status);

  const sponsors = await listSponsors(context.env);
  const origin = new URL(context.request.url).origin;

  const sponsorsWithUrls = sponsors.map((s) => ({
    ...s,
    url: `${origin}/thanks-${s.slug}`,
  }));

  return json({ sponsors: sponsorsWithUrls });
}

export async function onRequestPost(context) {
  const authErr = checkAdminAuth(context);
  if (authErr) return json({ error: authErr.error }, authErr.status);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const name = String(body.name || "").trim();
  const rawSlug = String(body.slug || "").trim();
  const amount = Number(body.amount);
  const description = String(body.description || "").trim();
  const contactEmail = String(body.contactEmail || "").trim();

  if (!name) {
    return json({ error: "Sponsor name is required" }, 400);
  }

  if (isNaN(amount) || amount <= 0) {
    return json({ error: "Payment amount must be a positive number" }, 400);
  }

  // Generate or clean slug
  let slug = rawSlug
    ? rawSlug.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "")
    : name.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");

  if (!slug) {
    slug = `sponsor-${Math.random().toString(36).substring(2, 8)}`;
  }

  // Check if slug already exists
  const existing = await getSponsorBySlug(context.env, slug);
  if (existing) {
    return json(
      { error: `The URL slug '${slug}' is already in use. Please choose another slug.` },
      400
    );
  }

  const sponsorData = {
    name,
    slug,
    amount: Math.round(amount),
    description,
    contactEmail,
    status: "pending",
  };

  const created = await createSponsor(context.env, sponsorData);
  const origin = new URL(context.request.url).origin;
  const customUrl = `${origin}/thanks-${slug}`;

  return json(
    {
      sponsor: created || sponsorData,
      url: customUrl,
      message: "Sponsor link successfully created",
    },
    201
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Password",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
