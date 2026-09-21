#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildConfirmationEmail,
  sendConfirmationEmailWithBrevo,
  buildSponsorEmail,
  sendSponsorEmailWithBrevo,
} from "../functions/lib/email.js";

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
  const isSponsor = args.includes("--sponsor");
  const toArg = args.find((a) => !a.startsWith("--")) || args.find((a) => a.startsWith("--to="))?.replace("--to=", "");
  const isDryRun = args.includes("--dry-run");

  const apiKey = env.BREVO_API_KEY;

  console.log(`=== Super Office Hours — ${isSponsor ? "Sponsor" : "Attendee"} Brevo Email Test ===\n`);

  let textPreview = "";

  if (isSponsor) {
    const samplePayload = {
      sponsorName: "Acme Innovations Inc.",
      contactName: "Jane Doe",
      amount: 500000,
      description: "Super Office Hours Partnership & Sponsorship Package",
    };
    const { text } = buildSponsorEmail(samplePayload);
    textPreview = text;
  } else {
    const samplePayload = {
      name: "Taro Tester",
      lineItems: [
        { description: "Startup ticket", quantity: 1, amount_total: 3000 },
        { description: "LP Dinner (Sep 24)", quantity: 1, amount_total: 25000 },
      ],
      totalAmount: 28000,
    };
    const { text } = buildConfirmationEmail(samplePayload);
    textPreview = text;
  }

  console.log("Generated Plain Text Preview:");
  console.log("-----------------------------------------");
  console.log(textPreview);
  console.log("-----------------------------------------\n");

  if (isDryRun || !toArg) {
    console.log("ℹ️  Dry run completed (no email sent).");
    console.log("To send an actual test email via Brevo REST API, run:");
    console.log(`  npm run test:email -- ${isSponsor ? "--sponsor " : ""}your-email@example.com\n`);
    return;
  }

  if (!apiKey || apiKey.startsWith("fake_")) {
    console.error("❌ Error: BREVO_API_KEY is required in .dev.vars to send live emails.");
    console.error("Get your API key at: https://app.brevo.com/settings/keys/api");
    process.exit(1);
  }

  console.log(`Sending ${isSponsor ? "sponsor" : "attendee"} confirmation email via Brevo API to ${toArg}...`);
  try {
    let res;
    if (isSponsor) {
      res = await sendSponsorEmailWithBrevo(env, {
        to: toArg,
        sponsorName: "Acme Innovations Inc.",
        contactName: "Jane Doe",
        amount: 500000,
        perks: [
          "Super Office Hours Partnership & Sponsorship Package",
          "VIP networking with startups & investors",
        ],
      });
    } else {
      res = await sendConfirmationEmailWithBrevo(env, {
        to: toArg,
        name: "Taro Tester",
        lineItems: [
          { description: "Startup ticket", quantity: 1, amount_total: 3000 },
          { description: "LP Dinner (Sep 24)", quantity: 1, amount_total: 25000 },
        ],
        totalAmount: 28000,
      });
    }

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
