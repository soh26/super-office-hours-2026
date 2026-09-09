import Stripe from "stripe";
import { WorkerMailer } from "worker-mailer";
import { buildConfirmationEmail } from "../lib/email.js";

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
    try {
      await sendTicketConfirmation(stripe, env, event.data.object);
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

export async function sendTicketConfirmation(stripe, env, session, MailerClass = WorkerMailer) {
  const email = session.customer_details?.email || session.customer_email;
  if (!email) return null;

  const name = session.metadata?.name || "";
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 20 });

  const { html, text } = buildConfirmationEmail({
    name,
    lineItems: lineItems.data,
    totalAmount: session.amount_total,
  });

  const mailer = await MailerClass.connect({
    credentials: {
      username: env.GMAIL_ADDRESS,
      password: env.GMAIL_APP_PASSWORD,
    },
    authType: "login",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
  });

  return await mailer.send({
    from: { name: "Super Office Hours", email: env.GMAIL_ADDRESS },
    to: { name, email },
    subject: "Your Super Office Hours ticket",
    html,
    text,
  });
}
