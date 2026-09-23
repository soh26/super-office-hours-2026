import { createCrewRegistration, listRegistrations } from "../../lib/supabase.js";

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

  const url = new URL(context.request.url);
  const statusParam = (url.searchParams.get("status") || "all").trim().toLowerCase();
  const typeParam = (url.searchParams.get("type") || "all").trim().toLowerCase();

  const registrations = await listRegistrations(context.env, {
    status: statusParam,
    type: typeParam,
  });

  return json({ registrations });
}

export async function onRequestPost(context) {
  const authErr = checkAdminAuth(context);
  if (authErr) return json({ error: authErr.error }, authErr.status);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON payload" }, 400);
  }

  const result = await createCrewRegistration(context.env, body);
  if (result.error) {
    return json({ error: result.error }, result.status || 400);
  }

  return json(result, 201);
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
