/**
 * Lightweight fetch-based Supabase client for Cloudflare Pages Functions
 * Works natively in edge runtime with zero external dependencies.
 */
import { resolveDetailedLocation } from "./japan-location.js";

function getSupabaseConfig(env) {
  const url = (env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (!url || !key) return null;
  return { url, key };
}

function getHeaders(key, prefer = "return=representation") {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

/**
 * Creates a pending registration record before redirecting to Stripe.
 */
export async function createPendingRegistration(env, data, fetchFn = fetch) {
  const config = getSupabaseConfig(env);
  if (!config) return null;

  const payload = {
    id: data.id || crypto.randomUUID(),
    full_name: data.name,
    email: data.email,
    company: data.company,
    role: data.role || null,
    tickets: data.tickets || {},
    total_amount: data.totalAmount || 0,
    currency: data.currency || "jpy",
    event_slug: data.eventSlug || "super-office-hours",
    payment_status: "pending",
    questionnaire: data.questionnaire || {},
    user_agent: data.userAgent || null,
    referrer: data.referrer || null,
  };

  try {
    const res = await fetchFn(`${config.url}/rest/v1/registrations`, {
      method: "POST",
      headers: getHeaders(config.key),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase] Pending registration insert returned ${res.status}: ${errText}`);
      return null;
    }

    const inserted = await res.json();
    return Array.isArray(inserted) ? inserted[0] : inserted;
  } catch (err) {
    console.warn("[Supabase] Failed to create pending registration:", err.message);
    return null;
  }
}

/**
 * Updates or records a registration as paid when a Stripe checkout session completes.
 */
export async function recordPaidRegistration(env, session, lineItems = [], fetchFn = fetch) {
  const config = getSupabaseConfig(env);
  if (!config) return null;

  const registrationId = session.metadata?.registration_id;
  const name = session.metadata?.name || session.customer_details?.name || "";
  const email = session.customer_details?.email || session.customer_email || session.metadata?.email || "";
  const company = session.metadata?.company || "";
  const role = session.metadata?.role || "";

  const simplifiedLineItems = lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    amount_total: item.amount_total,
  }));

  const paymentMeta = {
    stripe_payment_intent: session.payment_intent,
    amount_total: session.amount_total,
    currency: session.currency,
    line_items: simplifiedLineItems,
  };

  // 1. If we have a registration_id from pre-checkout, update the existing row
  if (registrationId) {
    try {
      const updateRes = await fetchFn(
        `${config.url}/rest/v1/registrations?id=eq.${encodeURIComponent(registrationId)}`,
        {
          method: "PATCH",
          headers: getHeaders(config.key),
          body: JSON.stringify({
            stripe_session_id: session.id,
            stripe_customer_id: session.customer || null,
            payment_status: "paid",
            metadata: paymentMeta,
          }),
        }
      );

      if (updateRes.ok) {
        const updated = await updateRes.json();
        if (Array.isArray(updated) && updated.length > 0) {
          return updated[0];
        }
      } else {
        const errText = await updateRes.text();
        console.warn(`[Supabase] Registration update returned ${updateRes.status}: ${errText}`);
      }
    } catch (err) {
      console.warn("[Supabase] Failed to update registration by ID:", err.message);
    }
  }

  // 2. If no record was updated or no registrationId, upsert by stripe_session_id
  try {
    const upsertRes = await fetchFn(
      `${config.url}/rest/v1/registrations?on_conflict=stripe_session_id`,
      {
        method: "POST",
        headers: getHeaders(config.key, "resolution=merge-duplicates,return=representation"),
        body: JSON.stringify({
          stripe_session_id: session.id,
          stripe_customer_id: session.customer || null,
          full_name: name,
          email,
          company,
          role: role || null,
          tickets: simplifiedLineItems,
          total_amount: session.amount_total,
          currency: session.currency || "jpy",
          event_slug: "super-office-hours",
          payment_status: "paid",
          metadata: paymentMeta,
        }),
      }
    );

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      console.warn(`[Supabase] Registration upsert returned ${upsertRes.status}: ${errText}`);
      return null;
    }

    const result = await upsertRes.json();
    return Array.isArray(result) ? result[0] : result;
  } catch (err) {
    console.warn("[Supabase] Failed to upsert paid registration:", err.message);
    return null;
  }
}

/**
 * Computes individual ticket type counts and total ticket count for a registration.
 * Handles both object representations { startup: 2, investor: 1 } and line item arrays
 * [{ description: "Startup ticket", quantity: 2 }].
 * If ticket breakdown is not explicitly present, falls back to questionnaire fields or defaults to 1.
 */
export function getRegistrationTicketCounts(reg) {
  const counts = {
    total: 0,
    startup: 0,
    investor: 0,
    student: 0,
    other: 0,
  };

  const tickets = reg?.tickets;
  let parsedFromTickets = false;

  if (Array.isArray(tickets)) {
    for (const item of tickets) {
      if (!item) continue;
      const desc = String(item.description || item.name || "").toLowerCase();
      const qty = Math.max(0, Number(item.quantity ?? 1) || 0);
      if (qty === 0) continue;

      if (desc.includes("startup")) {
        counts.startup += qty;
        parsedFromTickets = true;
      } else if (desc.includes("investor")) {
        counts.investor += qty;
        parsedFromTickets = true;
      } else if (desc.includes("student")) {
        counts.student += qty;
        parsedFromTickets = true;
      } else {
        counts.other += qty;
        parsedFromTickets = true;
      }
    }
  } else if (tickets && typeof tickets === "object") {
    for (const [key, val] of Object.entries(tickets)) {
      const lower = key.toLowerCase();
      const qty = Math.max(0, Number(val) || 0);
      if (qty === 0) continue;

      if (lower.includes("startup")) {
        counts.startup += qty;
        parsedFromTickets = true;
      } else if (lower.includes("investor")) {
        counts.investor += qty;
        parsedFromTickets = true;
      } else if (lower.includes("student")) {
        counts.student += qty;
        parsedFromTickets = true;
      } else if (lower.includes("dinner")) {
        // dinner add-on
      } else {
        counts.other += qty;
        parsedFromTickets = true;
      }
    }
  }

  // Fallback: If no tickets were found from `reg.tickets`, inspect questionnaire or fallback to 1
  if (!parsedFromTickets) {
    const q = reg?.questionnaire;
    if (q && typeof q === "object") {
      if (q.funding_stage || q.business_description || q.funding_amount_needed) {
        counts.startup = 1;
      } else if (q.investor_ticket_size || q.investor_focus_industries || q.investor_lead_ok) {
        counts.investor = 1;
      } else if (q.university || q.student_id || q.school) {
        counts.student = 1;
      } else {
        counts.other = 1;
      }
    } else {
      counts.other = 1;
    }
  }

  counts.total = counts.startup + counts.investor + counts.student + counts.other;
  return counts;
}

/**
 * Checks whether a registration contains a specific ticket type ('startup', 'investor', 'student').
 */
export function hasTicketType(reg, type) {
  const target = String(type || "").toLowerCase().trim();
  if (!target || target === "all") return true;

  const counts = getRegistrationTicketCounts(reg);
  if (target === "startup") return counts.startup > 0;
  if (target === "investor") return counts.investor > 0;
  if (target === "student") return counts.student > 0;
  if (target === "other") return counts.other > 0;
  return (counts[target] || 0) > 0;
}

/**
 * Lists registrations ordered by creation time descending.
 * Optionally filters by payment_status (e.g. 'pending', 'paid') and ticket type.
 */
export async function listRegistrations(env, options = {}, fetchFn = fetch) {
  const config = getSupabaseConfig(env);
  if (!config) return [];

  const status = typeof options === "string" ? options : options?.status;
  const type = typeof options === "object" ? options?.type : null;
  let query = `${config.url}/rest/v1/registrations?order=created_at.desc`;

  if (status && status !== "all") {
    query += `&payment_status=eq.${encodeURIComponent(status.trim().toLowerCase())}`;
  }

  try {
    const res = await fetchFn(query, {
      method: "GET",
      headers: getHeaders(config.key),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase] List registrations returned ${res.status}: ${errText}`);
      return [];
    }

    const rows = await res.json();
    let results = Array.isArray(rows) ? rows : [];
    if (type && type !== "all") {
      results = results.filter((r) => hasTicketType(r, type));
    }
    return results;
  } catch (err) {
    console.warn("[Supabase] Failed to list registrations:", err.message);
    return [];
  }
}

/**
 * Creates a custom sponsor link record.
 */
export async function createSponsor(env, data, fetchFn = fetch) {
  const config = getSupabaseConfig(env);
  if (!config) return null;

  const payload = {
    id: data.id || crypto.randomUUID(),
    name: data.name,
    slug: data.slug,
    amount: Number(data.amount),
    currency: data.currency ? String(data.currency).trim().toLowerCase() : "jpy",
    description: data.description || null,
    contact_email: data.contactEmail || null,
    status: data.status || "pending",
    metadata: data.metadata || {},
  };

  try {
    const res = await fetchFn(`${config.url}/rest/v1/sponsors`, {
      method: "POST",
      headers: getHeaders(config.key),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase] Create sponsor returned ${res.status}: ${errText}`);
      return null;
    }

    const inserted = await res.json();
    return Array.isArray(inserted) ? inserted[0] : inserted;
  } catch (err) {
    console.warn("[Supabase] Failed to create sponsor:", err.message);
    return null;
  }
}

/**
 * Fetches a sponsor by their custom URL slug.
 */
export async function getSponsorBySlug(env, slug, fetchFn = fetch) {
  const config = getSupabaseConfig(env);
  if (!config) return null;

  try {
    const cleanSlug = encodeURIComponent(String(slug).trim().toLowerCase());
    const res = await fetchFn(`${config.url}/rest/v1/sponsors?slug=eq.${cleanSlug}&limit=1`, {
      method: "GET",
      headers: getHeaders(config.key),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase] Fetch sponsor by slug returned ${res.status}: ${errText}`);
      return null;
    }

    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.warn("[Supabase] Failed to fetch sponsor by slug:", err.message);
    return null;
  }
}

/**
 * Lists all sponsors ordered by creation time descending.
 */
export async function listSponsors(env, fetchFn = fetch) {
  const config = getSupabaseConfig(env);
  if (!config) return [];

  try {
    const res = await fetchFn(`${config.url}/rest/v1/sponsors?order=created_at.desc`, {
      method: "GET",
      headers: getHeaders(config.key),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase] List sponsors returned ${res.status}: ${errText}`);
      return [];
    }

    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.warn("[Supabase] Failed to list sponsors:", err.message);
    return [];
  }
}

/**
 * Updates a sponsor record to paid after a successful Stripe checkout session.
 */
export async function recordPaidSponsor(env, session, fetchFn = fetch) {
  const config = getSupabaseConfig(env);
  if (!config) return null;

  const sponsorId = session.metadata?.sponsor_id;
  const sponsorSlug = session.metadata?.sponsor_slug;
  const payerName = session.metadata?.name || session.customer_details?.name || "";
  const payerEmail = session.customer_details?.email || session.customer_email || session.metadata?.email || "";

  const updatePayload = {
    status: "paid",
    stripe_session_id: session.id,
    stripe_payment_intent: session.payment_intent || null,
    paid_at: new Date().toISOString(),
    paid_by_name: payerName,
    paid_by_email: payerEmail,
    metadata: {
      amount_total: session.amount_total,
      currency: session.currency,
      paid_at: new Date().toISOString(),
    },
  };

  try {
    let queryParam = "";
    if (sponsorId) {
      queryParam = `id=eq.${encodeURIComponent(sponsorId)}`;
    } else if (sponsorSlug) {
      queryParam = `slug=eq.${encodeURIComponent(sponsorSlug.toLowerCase())}`;
    } else {
      console.warn("[Supabase] recordPaidSponsor requires sponsor_id or sponsor_slug");
      return null;
    }

    const res = await fetchFn(`${config.url}/rest/v1/sponsors?${queryParam}`, {
      method: "PATCH",
      headers: getHeaders(config.key),
      body: JSON.stringify(updatePayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase] Update sponsor paid status returned ${res.status}: ${errText}`);
      return null;
    }

    const updated = await res.json();
    return Array.isArray(updated) && updated.length > 0 ? updated[0] : null;
  } catch (err) {
    console.warn("[Supabase] Failed to update sponsor paid status:", err.message);
    return null;
  }
}

/**
 * Fetches a sponsor by their UUID id.
 */
export async function getSponsorById(env, id, fetchFn = fetch) {
  const config = getSupabaseConfig(env);
  if (!config) return null;

  try {
    const cleanId = encodeURIComponent(String(id).trim());
    const res = await fetchFn(`${config.url}/rest/v1/sponsors?id=eq.${cleanId}&limit=1`, {
      method: "GET",
      headers: getHeaders(config.key),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase] Fetch sponsor by id returned ${res.status}: ${errText}`);
      return null;
    }

    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.warn("[Supabase] Failed to fetch sponsor by id:", err.message);
    return null;
  }
}

/**
 * Updates a pending sponsor record.
 * Refuses update if sponsor is in 'paid' status.
 */
export async function updatePendingSponsor(env, id, updates, fetchFn = fetch) {
  const config = getSupabaseConfig(env);
  if (!config) return { error: "Database not configured", status: 500 };

  const existing = await getSponsorById(env, id, fetchFn);
  if (!existing) {
    return { error: "Sponsor not found", status: 404 };
  }

  if (existing.status === "paid") {
    return {
      error: "This sponsor package has already been paid. No actions are permitted on paid payments.",
      status: 400,
    };
  }

  const payload = {};
  if (updates.name !== undefined) payload.name = String(updates.name).trim();
  if (updates.slug !== undefined) payload.slug = String(updates.slug).trim().toLowerCase();
  if (updates.amount !== undefined) payload.amount = Math.round(Number(updates.amount));
  if (updates.currency !== undefined) payload.currency = String(updates.currency).trim().toLowerCase();
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.contactEmail !== undefined) payload.contact_email = updates.contactEmail;
  if (updates.metadata !== undefined) payload.metadata = updates.metadata;

  try {
    const cleanId = encodeURIComponent(String(id).trim());
    const res = await fetchFn(`${config.url}/rest/v1/sponsors?id=eq.${cleanId}&status=eq.pending`, {
      method: "PATCH",
      headers: getHeaders(config.key),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase] Update pending sponsor returned ${res.status}: ${errText}`);
      return { error: `Database error: ${errText}`, status: 500 };
    }

    const updated = await res.json();
    const result = Array.isArray(updated) && updated.length > 0 ? updated[0] : { ...existing, ...payload };
    return { data: result };
  } catch (err) {
    console.warn("[Supabase] Failed to update pending sponsor:", err.message);
    return { error: err.message, status: 500 };
  }
}

/**
 * Deletes a pending sponsor record.
 * Refuses deletion if sponsor is in 'paid' status.
 */
export async function deletePendingSponsor(env, id, fetchFn = fetch) {
  const config = getSupabaseConfig(env);
  if (!config) return { error: "Database not configured", status: 500 };

  const existing = await getSponsorById(env, id, fetchFn);
  if (!existing) {
    return { error: "Sponsor not found", status: 404 };
  }

  if (existing.status === "paid") {
    return {
      error: "This sponsor package has already been paid. No actions are permitted on paid payments.",
      status: 400,
    };
  }

  try {
    const cleanId = encodeURIComponent(String(id).trim());
    const res = await fetchFn(`${config.url}/rest/v1/sponsors?id=eq.${cleanId}&status=eq.pending`, {
      method: "DELETE",
      headers: getHeaders(config.key),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase] Delete pending sponsor returned ${res.status}: ${errText}`);
      return { error: `Database error: ${errText}`, status: 500 };
    }

    const deleted = await res.json();
    return {
      success: true,
      deleted: Array.isArray(deleted) && deleted.length > 0 ? deleted[0] : existing,
    };
  } catch (err) {
    console.warn("[Supabase] Failed to delete pending sponsor:", err.message);
    return { error: err.message, status: 500 };
  }
}

/**
 * Records an access log / view for a sponsor link.
 * Collects timestamp and city (and country if available).
 * Stores in sponsor_views table and updates sponsor metadata.
 */
export async function recordSponsorView(
  env,
  {
    sponsor,
    sponsorId,
    slug,
    city,
    country,
    region,
    regionCode,
    postalCode,
    latitude,
    longitude,
    timestamp,
    userAgent,
  },
  fetchFn = fetch
) {
  const config = getSupabaseConfig(env);
  const now = timestamp || new Date().toISOString();
  const cleanSlug = String(slug || (sponsor && sponsor.slug) || "").trim().toLowerCase();
  const targetId = sponsorId || (sponsor && sponsor.id) || null;

  // Resolve detailed location (especially ward/city/town for Japan)
  let resolvedCity = (city && String(city).trim()) || "Unknown";
  let resolvedCountry = (country && String(country).trim()) || null;

  try {
    const loc = await resolveDetailedLocation({
      city: resolvedCity,
      country: resolvedCountry,
      region,
      regionCode,
      postalCode,
      latitude,
      longitude,
      fetchFn,
    });
    if (loc && loc.resolvedCity) {
      resolvedCity = loc.resolvedCity;
      resolvedCountry = loc.country || resolvedCountry;
    }
  } catch (locErr) {
    console.warn("[SponsorView] Location resolution error:", locErr.message);
  }

  // 1. Structured log
  console.log(
    `[SponsorAccessLog] ${JSON.stringify({
      slug: cleanSlug,
      city: resolvedCity,
      country: resolvedCountry,
      timestamp: now,
    })}`
  );

  if (!config) return { success: false, reason: "no_config" };

  // 2. Insert into sponsor_views table
  try {
    const logPayload = {
      sponsor_id: targetId,
      sponsor_slug: cleanSlug,
      city: resolvedCity,
      country: resolvedCountry,
      viewed_at: now,
      user_agent: userAgent || null,
    };

    await fetchFn(`${config.url}/rest/v1/sponsor_views`, {
      method: "POST",
      headers: getHeaders(config.key),
      body: JSON.stringify(logPayload),
    });
  } catch {
    // Non-fatal if table not yet created
  }

  // 3. Keep views in sponsor metadata for instant retrieval
  try {
    let targetSponsor = sponsor;
    if (!targetSponsor && targetId) {
      targetSponsor = await getSponsorById(env, targetId, fetchFn);
    } else if (!targetSponsor && cleanSlug) {
      targetSponsor = await getSponsorBySlug(env, cleanSlug, fetchFn);
    }

    if (targetSponsor && targetSponsor.id) {
      const currentMetadata = targetSponsor.metadata || {};
      const existingViews = Array.isArray(currentMetadata.views) ? currentMetadata.views : [];
      const updatedViews = [
        {
          timestamp: now,
          city: resolvedCity,
          country: resolvedCountry,
        },
        ...existingViews,
      ].slice(0, 100);

      const updatedCount = (Number(currentMetadata.view_count) || existingViews.length) + 1;

      const newMetadata = {
        ...currentMetadata,
        view_count: updatedCount,
        views: updatedViews,
      };

      await fetchFn(
        `${config.url}/rest/v1/sponsors?id=eq.${encodeURIComponent(targetSponsor.id)}`,
        {
          method: "PATCH",
          headers: getHeaders(config.key),
          body: JSON.stringify({ metadata: newMetadata }),
        }
      );
    }
  } catch (err) {
    console.warn("[Supabase] Failed to update sponsor views metadata:", err.message);
  }

  return { success: true, timestamp: now, city: resolvedCity, country: resolvedCountry };
}

/**
 * Retrieves access logs / views for a sponsor link.
 */
export async function getSponsorViews(env, sponsorIdOrSlug, fetchFn = fetch) {
  const config = getSupabaseConfig(env);
  if (!config) return [];

  const clean = encodeURIComponent(String(sponsorIdOrSlug).trim().toLowerCase());

  // 1. Try querying from sponsor_views table
  try {
    const res = await fetchFn(
      `${config.url}/rest/v1/sponsor_views?or=(sponsor_id.eq.${clean},sponsor_slug.eq.${clean})&order=viewed_at.desc&limit=200`,
      {
        method: "GET",
        headers: getHeaders(config.key),
      }
    );

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map((r) => ({
          timestamp: r.viewed_at,
          city: r.city || "Unknown",
          country: r.country || null,
        }));
      }
    }
  } catch {
    // Fallback to metadata
  }

  // 2. Fallback to sponsor metadata.views
  try {
    let sponsor = await getSponsorById(env, sponsorIdOrSlug, fetchFn);
    if (!sponsor) {
      sponsor = await getSponsorBySlug(env, sponsorIdOrSlug, fetchFn);
    }

    if (sponsor && sponsor.metadata && Array.isArray(sponsor.metadata.views)) {
      return sponsor.metadata.views;
    }
  } catch {
    // return empty
  }

  return [];
}


