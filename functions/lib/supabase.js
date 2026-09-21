/**
 * Lightweight fetch-based Supabase client for Cloudflare Pages Functions
 * Works natively in edge runtime with zero external dependencies.
 */

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
    currency: data.currency || "jpy",
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
