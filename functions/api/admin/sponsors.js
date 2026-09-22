import {
  createSponsor,
  deletePendingSponsor,
  getSponsorById,
  getSponsorBySlug,
  listSponsors,
  updatePendingSponsor,
} from "../../lib/supabase.js";

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
  const perks = Array.isArray(body.perks)
    ? body.perks.map((p) => String(p || "").trim()).filter(Boolean)
    : (body.description ? String(body.description).split("\n").map(p => p.trim()).filter(Boolean) : []);
  const description = perks.length > 0 ? perks.join("\n") : String(body.description || "").trim();
  const contactEmail = String(body.contactEmail || "").trim() || null;

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
    metadata: {
      perks,
    },
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

export async function onRequestPut(context) {
  const authErr = checkAdminAuth(context);
  if (authErr) return json({ error: authErr.error }, authErr.status);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const id = String(body.id || "").trim();
  if (!id) {
    return json({ error: "Sponsor ID is required for updates" }, 400);
  }

  const existing = await getSponsorById(context.env, id);
  if (!existing) {
    return json({ error: "Sponsor link not found" }, 404);
  }

  if (existing.status === "paid") {
    return json(
      { error: "This sponsor package has already been paid. No actions are permitted on paid payments." },
      400
    );
  }

  const updates = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return json({ error: "Sponsor name cannot be empty" }, 400);
    updates.name = name;
  }

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return json({ error: "Payment amount must be a positive number" }, 400);
    }
    updates.amount = Math.round(amount);
  }

  if (body.slug !== undefined) {
    const rawSlug = String(body.slug).trim();
    const cleanSlug = rawSlug.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
    if (!cleanSlug) {
      return json({ error: "Invalid URL slug" }, 400);
    }
    if (cleanSlug !== existing.slug) {
      const slugOwner = await getSponsorBySlug(context.env, cleanSlug);
      if (slugOwner && slugOwner.id !== id) {
        return json({ error: `The URL slug '${cleanSlug}' is already in use. Please choose another slug.` }, 400);
      }
    }
    updates.slug = cleanSlug;
  }

  if (body.perks !== undefined || body.description !== undefined) {
    const perks = Array.isArray(body.perks)
      ? body.perks.map((p) => String(p || "").trim()).filter(Boolean)
      : (body.description ? String(body.description).split("\n").map((p) => p.trim()).filter(Boolean) : []);
    updates.description = perks.length > 0 ? perks.join("\n") : String(body.description || "").trim();
    updates.metadata = {
      ...(existing.metadata || {}),
      perks,
    };
  }

  const res = await updatePendingSponsor(context.env, id, updates);
  if (res.error) {
    return json({ error: res.error }, res.status || 500);
  }

  const origin = new URL(context.request.url).origin;
  const updatedSponsor = res.data;
  const customUrl = `${origin}/thanks-${updatedSponsor.slug}`;

  return json({
    sponsor: updatedSponsor,
    url: customUrl,
    message: "Sponsor link successfully updated",
  });
}

export async function onRequestPatch(context) {
  return onRequestPut(context);
}

export async function onRequestDelete(context) {
  const authErr = checkAdminAuth(context);
  if (authErr) return json({ error: authErr.error }, authErr.status);

  const url = new URL(context.request.url);
  let id = url.searchParams.get("id");

  if (!id) {
    try {
      const body = await context.request.json();
      id = body.id;
    } catch {
      // Ignored if request had no JSON body
    }
  }

  id = String(id || "").trim();
  if (!id) {
    return json({ error: "Sponsor ID is required for deletion" }, 400);
  }

  const existing = await getSponsorById(context.env, id);
  if (!existing) {
    return json({ error: "Sponsor link not found" }, 404);
  }

  if (existing.status === "paid") {
    return json(
      { error: "This sponsor package has already been paid. No actions are permitted on paid payments." },
      400
    );
  }

  const res = await deletePendingSponsor(context.env, id);
  if (res.error) {
    return json({ error: res.error }, res.status || 500);
  }

  return json({
    success: true,
    message: "Sponsor link successfully deleted",
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Password",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

