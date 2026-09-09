#!/usr/bin/env node
import "../test/cf-sockets-shim.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WorkerMailer } from "worker-mailer";
import { buildConfirmationEmail } from "../functions/lib/email.js";

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

  const gmailAddress = env.GMAIL_ADDRESS;
  const gmailAppPassword = env.GMAIL_APP_PASSWORD;

  console.log("=== Super Office Hours — Email Test ===\n");

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
    console.log("To send an actual test email over SMTP, run:");
    console.log("  npm run test:email -- your-email@example.com\n");
    return;
  }

  if (!gmailAddress || !gmailAppPassword || gmailAppPassword.startsWith("fake_")) {
    console.error("❌ Error: GMAIL_ADDRESS and a valid GMAIL_APP_PASSWORD are required in .dev.vars to send live emails.");
    process.exit(1);
  }

  console.log(`Connecting to smtp.gmail.com:465 as ${gmailAddress}...`);
  try {
    const mailer = await WorkerMailer.connect({
      credentials: {
        username: gmailAddress,
        password: gmailAppPassword,
      },
      authType: "login",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
    });

    console.log(`Sending confirmation email to ${toArg}...`);
    const res = await mailer.send({
      from: { name: "Super Office Hours [TEST]", email: gmailAddress },
      to: { name: samplePayload.name, email: toArg },
      subject: "[TEST] Your Super Office Hours ticket",
      html,
      text,
    });

    console.log("✅ Email sent successfully!");
    console.log("Response:", res);
  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
    if (err.message?.includes("Username and Password not accepted") || err.message?.includes("535")) {
      console.error("\nTip: Make sure you have 2-Step Verification enabled and generated an App Password at:");
      console.error("https://myaccount.google.com/apppasswords");
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
