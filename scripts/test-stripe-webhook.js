#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function loadDevVars() {
  const env = { ...process.env };
  const devVarsPath = path.join(rootDir, ".dev.vars");
  if (fs.existsSync(devVarsPath)) {
    const lines = fs.readFileSync(devVarsPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!env[key]) env[key] = val;
      }
    }
  }
  return env;
}

async function main() {
  const env = loadDevVars();
  const args = process.argv.slice(2);
  const targetUrl =
    args.find((a) => a.startsWith("--url="))?.replace("--url=", "") ||
    "http://localhost:8787/api/stripe-webhook";

  const secretKey = env.STRIPE_SECRET_KEY || "sk_test_mock";
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  console.log("=== Super Office Hours — Stripe Webhook Tester ===\n");
  console.log(`Target Endpoint: ${targetUrl}`);

  if (!webhookSecret) {
    console.error("❌ Error: STRIPE_WEBHOOK_SECRET is missing in .dev.vars.");
    console.error("Run `stripe listen --forward-to localhost:8787/api/stripe-webhook` to get your whsec_... key.");
    process.exit(1);
  }

  const stripe = new Stripe(secretKey);

  const sessionId = "cs_test_" + Date.now();
  const sampleEvent = {
    id: "evt_test_" + Date.now(),
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        amount_total: 7500,
        currency: "jpy",
        customer: "cus_test_" + Date.now(),
        customer_details: {
          email: "webhook-tester@example.com",
          name: "Test Attendee",
        },
        metadata: {
          registration_id: crypto.randomUUID(),
          name: "Test Attendee",
          company: "Acme Corp",
          role: "Founder",
          email: "webhook-tester@example.com",
        },
        payment_status: "paid",
        status: "complete",
      },
    },
  };

  const payload = JSON.stringify(sampleEvent);
  const signatureHeader = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });

  console.log(`Generated Event ID: ${sampleEvent.id}`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`Signature: ${signatureHeader.slice(0, 32)}...`);
  console.log("\nSending POST request...");

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signatureHeader,
      },
      body: payload,
    });

    console.log(`Response Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Response Body: ${text}`);

    if (res.ok) {
      console.log("\n✅ Webhook delivered and accepted successfully!");
    } else {
      console.error(`\n❌ Webhook rejected by server (Status ${res.status}). Check server logs.`);
    }
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.message?.includes("fetch failed")) {
      console.error(`\n❌ Connection failed: Could not connect to ${targetUrl}`);
      console.error("Make sure your local server is running on :8787 (`npm run dev:functions`).");
    } else {
      console.error("\n❌ Unexpected error:", err.message);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
