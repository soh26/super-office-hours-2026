#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfirmationEmail, sendConfirmationEmailWithBrevo } from "../functions/lib/email.js";

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
  const toArg = args.find((a) => a.startsWith("--to="))?.replace("--to=", "") || args[0];
  const isDryRun = args.includes("--dry-run");

  const apiKey = env.BREVO_API_KEY;

  console.log("=== Super Office Hours — Brevo Email Test ===\n");

  const samplePayload = {
    name: "Taro Tester",
    lineItems: [
      { description: "Startup ticket", quantity: 1, amount_total: 2500 },
      { description: "LP Dinner (Sep 24)", quantity: 1, amount_total: 25000 },
    ],
    totalAmount: 27500,
  };

  const { html, text } = buildConfirmationEmail(samplePayload);

  console.log("Generated Plain Text Preview:");
  console.log("-----------------------------------------");
  console.log(text);
  console.log("-----------------------------------------\n");

  if (isDryRun || !toArg) {
    console.log("ℹ️  Dry run completed (no email sent).");
    console.log("To send an actual test email via Brevo REST API, run:");
    console.log("  npm run test:email -- your-email@example.com\n");
    return;
  }

  if (!apiKey || apiKey.startsWith("fake_")) {
    console.error("❌ Error: BREVO_API_KEY is required in .dev.vars to send live emails.");
    console.error("Get your API key at: https://app.brevo.com/settings/keys/api");
    process.exit(1);
  }

  console.log(`Sending confirmation email via Brevo API to ${toArg}...`);
  try {
    const res = await sendConfirmationEmailWithBrevo(env, {
      to: toArg,
      name: samplePayload.name,
      lineItems: samplePayload.lineItems,
      totalAmount: samplePayload.totalAmount,
    });

    if (res) {
      console.log("✅ Email sent successfully via Brevo!");
      console.log("Message ID:", res.messageId || res);
    } else {
      console.error("❌ Failed to send email via Brevo. Check console logs above.");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Unexpected error:", err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
