export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function onRequestPost(context) {
  const adminPassword = (
    context.env.SPONSOR_ADMIN_PASSWORD ||
    context.env.ADMIN_PASSWORD ||
    ""
  ).trim();

  if (!adminPassword) {
    return json({ error: "SPONSOR_ADMIN_PASSWORD is not configured in server environment" }, 500);
  }

  let body = {};
  try {
    body = await context.request.json();
  } catch {
    // Body is optional if authorization header is provided
  }

  const authHeader = context.request.headers.get("Authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const passwordAttempt = (body.password || bearerToken || "").trim();

  if (!passwordAttempt) {
    return json({ error: "Password required" }, 400);
  }

  if (passwordAttempt !== adminPassword) {
    return json({ error: "Invalid password" }, 401);
  }

  return json({
    success: true,
    message: "Authenticated",
  });
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
