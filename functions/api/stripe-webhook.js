import Stripe from "stripe";
import { sendConfirmationEmailWithBrevo } from "../lib/email.js";
import { recordPaidRegistration } from "../lib/supabase.js";

export async function onRequestPost(context) {
  const { env, request } = context;

  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe env vars are not configured", { status: 500 });
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, {
      status: 400,
    });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    let lineItems = [];
    try {
      const itemsRes = await stripe.checkout.sessions.listLineItems(session.id, { limit: 20 });
      lineItems = itemsRes.data || [];
    } catch (err) {
      console.error("Failed to fetch session line items from Stripe:", err);
    }

    // 1. Record / update paid registration status in Supabase
    try {
      await recordPaidRegistration(env, session, lineItems);
    } catch (err) {
      console.error("Failed to record paid registration in Supabase:", err);
    }

    // 2. Send HTML confirmation email via Brevo
    try {
      await sendTicketConfirmation(stripe, env, session, { lineItems });
    } catch (err) {
      // Don't fail the webhook over an email issue — Stripe already has the payment recorded,
      // and a non-2xx response here would make Stripe retry the whole event indefinitely.
      console.error("Failed to send ticket confirmation email:", err);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function sendTicketConfirmation(stripe, env, session, options = {}) {
  const preloadedLineItems = options && typeof options === "object" ? options.lineItems : null;
  const email = session.customer_details?.email || session.customer_email || session.metadata?.email;
  if (!email) return null;

  const name = session.metadata?.name || session.customer_details?.name || "";
  let lineItemsData = preloadedLineItems;
  if (!lineItemsData && stripe?.checkout?.sessions?.listLineItems) {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 20 });
    lineItemsData = lineItems.data;
  }

  const fetchFn = typeof options === "object" && options.fetchFn ? options.fetchFn : fetch;

  return await sendConfirmationEmailWithBrevo(
    env,
    {
      to: email,
      name,
      lineItems: lineItemsData || [],
      totalAmount: session.amount_total,
    },
    fetchFn
  );
}
