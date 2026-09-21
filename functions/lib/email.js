export function formatYen(amount) {
  return "¥" + Number(amount).toLocaleString("en-US");
}

export function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]
  );
}

export function buildConfirmationEmail({ name, lineItems, totalAmount }) {
  const displayName = name || "there";
  const safeName = escapeHtml(displayName);

  const rowsHtml = lineItems
    .map(
      (item) => `
                    <tr>
                      <td style="padding:4px 0;color:rgba(255,255,255,0.6);font-size:14px;">${escapeHtml(item.description)} &times; ${item.quantity}</td>
                      <td style="padding:4px 0;color:#ffffff;font-size:14px;text-align:right;">${formatYen(item.amount_total)}</td>
                    </tr>`
    )
    .join("");

  const rowsText = lineItems
    .map((item) => `${item.description} x${item.quantity}    ${formatYen(item.amount_total)}`)
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0c;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0c;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#1c1c22;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <div style="font-weight:700;font-size:15px;letter-spacing:-0.02em;color:#ffffff;">
                  TAKEOFF <span style="color:#2dd4bf;">tokyo</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0 32px;">
                <div style="display:inline-block;padding:4px 12px;border-radius:9999px;background:rgba(45,212,191,0.12);color:#2dd4bf;font-size:12px;font-weight:600;">
                  Ticket confirmed
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0 32px;">
                <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.02em;">Super Office Hours</h1>
                <p style="margin:4px 0 0 0;color:rgba(255,255,255,0.6);font-size:14px;">September 25, 2026 &middot; Dragon Gate, Shibuya, Tokyo</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0 32px;">
                <p style="margin:0 0 12px 0;color:#ffffff;font-size:15px;line-height:1.6;">Hi ${safeName},</p>
                <p style="margin:0;color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;">
                  Thank you for your purchase — you're confirmed for Super Office Hours.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0 32px;">
                <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;">
                  <div style="color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">Your ticket</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}
                    <tr>
                      <td style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);color:#ffffff;font-weight:700;font-size:15px;">Total</td>
                      <td style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);color:#ffffff;font-weight:700;font-size:15px;text-align:right;">${formatYen(totalAmount)}</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 32px 32px;">
                <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;">
                  Questions? Reply to this email — we're happy to help.<br/>
                  &copy; 2026 TAKEOFF tokyo. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Super Office Hours — your ticket is confirmed

Hi ${displayName},

Thank you for your purchase — you're confirmed for Super Office Hours.
September 25, 2026 · Dragon Gate, Shibuya, Tokyo

Your ticket
${rowsText}
Total    ${formatYen(totalAmount)}

Questions? Reply to this email — we're happy to help.
© 2026 TAKEOFF tokyo. All rights reserved.`;

  return { html, text };
}

/**
 * Sends confirmation email using Brevo (formerly Sendinblue) Transactional Email API.
 */
export async function sendConfirmationEmailWithBrevo(
  env,
  { to, name, lineItems = [], totalAmount = 0 },
  fetchFn = fetch
) {
  const apiKey = (env.BREVO_API_KEY || "").trim();
  if (!apiKey) {
    console.warn("[Brevo] Skipping email confirmation: BREVO_API_KEY is not set.");
    return null;
  }

  const senderEmail = env.BREVO_SENDER_EMAIL || "tickets@takeoff-tokyo.com";
  const senderName = env.BREVO_SENDER_NAME || "Super Office Hours";

  const { html, text } = buildConfirmationEmail({
    name,
    lineItems,
    totalAmount,
  });

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to, name: name || undefined }],
    subject: "Your Super Office Hours ticket",
    htmlContent: html,
    textContent: text,
  };

  try {
    const res = await fetchFn("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Brevo] Failed to send email (HTTP ${res.status}): ${errBody}`);
      return null;
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[Brevo] Network error sending email:", err.message);
    return null;
  }
}

/**
 * Generates HTML and plain text for the separate Sponsor Confirmation Email.
 */
export function buildSponsorEmail({ sponsorName, contactName, amount, description, perks }) {
  const safeSponsorName = escapeHtml(sponsorName || "Valued Sponsor");
  const displayName = contactName ? escapeHtml(contactName) : safeSponsorName;
  const formattedAmount = formatYen(amount);

  const perkList = Array.isArray(perks) && perks.length > 0
    ? perks.map((p) => String(p || "").trim()).filter(Boolean)
    : (typeof description === "string" && description.trim()
        ? description.split("\n").map((p) => p.trim()).filter(Boolean)
        : []);

  const perksHtml = perkList.length > 0
    ? `<!-- Value Checklist -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                        ${perkList
                          .map(
                            (p) => `<tr>
                          <td style="padding:3px 0;color:rgba(255,255,255,0.7);font-size:13px;line-height:1.5;">
                            <span style="color:#2dd4bf;font-weight:800;margin-right:6px;">&#10003;</span> ${escapeHtml(p)}
                          </td>
                        </tr>`
                          )
                          .join("\n")}
                      </table>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Super Office Hours — Sponsor Confirmation</title>
  </head>
  <body style="margin:0;padding:0;background:#0a0a0c;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0c;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background:#141418;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;box-shadow:0 20px 40px -15px rgba(0,0,0,0.7);">
            
            <!-- Site Header with Takeoff Tokyo Logo -->
            <tr>
              <td style="padding:24px 32px;background:#0e0e12;border-bottom:1px solid rgba(255,255,255,0.08);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left" vertical-align="middle">
                      <a href="https://soh.takeoff-tokyo.com/" target="_blank" style="text-decoration:none;display:inline-block;">
                        <img
                          src="https://s.takeoff-tokyo.com/images/takeoff-tokyo-logo.png"
                          alt="TAKEOFF tokyo"
                          height="26"
                          style="height:26px;width:auto;display:block;border:0;outline:none;"
                        />
                      </a>
                    </td>
                    <td align="right" vertical-align="middle">
                      <div style="display:inline-block;padding:3px 10px;border-radius:9999px;background:rgba(45,212,191,0.1);border:1px solid rgba(45,212,191,0.3);color:#2dd4bf;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                        Sponsor Confirmation
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Hero Section matching Main Site -->
            <tr>
              <td align="center" style="padding:32px 32px 20px 32px;text-align:center;">
                <!-- Tagline Badge -->
                <div style="display:inline-block;padding:4px 14px;border-radius:9999px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);font-size:11px;margin-bottom:16px;">
                  By TAKEOFF tokyo &middot; Asia's flagship startup conference, since 2023
                </div>

                <!-- Event Title -->
                <h1 style="margin:0 0 6px 0;color:#ffffff;font-size:28px;font-weight:900;letter-spacing:-0.03em;text-transform:uppercase;line-height:1.1;">
                  SUPER OFFICE HOURS
                </h1>
                <p style="margin:0;color:rgba(255,255,255,0.6);font-size:14px;letter-spacing:-0.01em;">
                  September 25, 2026 &middot; Dragon Gate, Shibuya, Tokyo
                </p>
              </td>
            </tr>

            <!-- Event Stats Ribbon -->
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.08);border-bottom:1px solid rgba(255,255,255,0.08);padding:14px 0;">
                  <tr>
                    <td align="center" width="33%" style="text-align:center;">
                      <div style="font-size:18px;font-weight:800;color:#ffffff;line-height:1.1;">50</div>
                      <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">investors</div>
                    </td>
                    <td align="center" width="33%" style="text-align:center;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06);">
                      <div style="font-size:18px;font-weight:800;color:#ffffff;line-height:1.1;">100</div>
                      <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">startups</div>
                    </td>
                    <td align="center" width="33%" style="text-align:center;">
                      <div style="font-size:18px;font-weight:800;color:#ffffff;line-height:1.1;">400</div>
                      <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">meetings</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Sponsor Welcome Note -->
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <p style="margin:0 0 12px 0;color:#ffffff;font-size:16px;line-height:1.6;font-weight:600;">Dear ${displayName},</p>
                <p style="margin:0;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.65;">
                  We are honored to welcome <strong>${safeSponsorName}</strong> as an official sponsor of Super Office Hours. Your support directly powers founders and investors taking off from Tokyo.
                </p>
              </td>
            </tr>

            <!-- Featured Ticket Card styling from main site -->
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1c1c22;border:1px solid #2dd4bf;border-radius:14px;overflow:hidden;box-shadow:0 0 24px -6px rgba(45,212,191,0.2);">
                  <tr>
                    <td style="padding:22px 24px;">
                      <div style="color:#2dd4bf;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">
                        Partner Package
                      </div>
                      <div style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.02em;margin-bottom:12px;">
                        ${safeSponsorName} Sponsorship
                      </div>
                      
                      ${perksHtml}

                      <!-- Total Paid Summary -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.08);padding-top:14px;">
                        <tr>
                          <td style="color:#ffffff;font-weight:700;font-size:15px;">Total Paid</td>
                          <td align="right" style="color:#2dd4bf;font-weight:800;font-size:20px;text-align:right;">
                            ${formattedAmount} <span style="font-size:11px;font-weight:600;color:rgba(45,212,191,0.8);">JPY</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Help / Contact Footer matching Main Site -->
            <tr>
              <td style="padding:20px 32px 28px 32px;background:#0e0e12;border-top:1px solid rgba(255,255,255,0.08);">
                <p style="margin:0 0 10px 0;color:rgba(255,255,255,0.5);font-size:12px;line-height:1.6;">
                  Have questions or need to submit your high-res logo? Reply directly to this email or reach our partnership team at <a href="mailto:tickets@takeoff-tokyo.com" style="color:#2dd4bf;text-decoration:none;">tickets@takeoff-tokyo.com</a>.
                </p>
                <div style="font-size:11px;color:rgba(255,255,255,0.3);line-height:1.5;">
                  &copy; 2026 TAKEOFF tokyo. Super Office Hours &middot; Dragon Gate, Shibuya, Tokyo.<br/>
                  <a href="https://www.takeoff-tokyo.com/terms-conditions" target="_blank" style="color:rgba(255,255,255,0.4);text-decoration:none;">Terms &amp; Conditions</a> &middot;
                  <a href="https://www.takeoff-tokyo.com/privacy-policy" target="_blank" style="color:rgba(255,255,255,0.4);text-decoration:none;">Privacy Policy</a> &middot;
                  <a href="https://www.takeoff-tokyo.com/scta" target="_blank" style="color:rgba(255,255,255,0.4);text-decoration:none;">Commercial Disclosure</a>
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const perksText = perkList.length > 0
    ? `\nPackage Benefits:\n${perkList.map((p) => `✓ ${p}`).join("\n")}\n`
    : "";

  const text = `SUPER OFFICE HOURS — SPONSOR CONFIRMATION

Thank you, ${sponsorName || "Valued Sponsor"}!

Dear ${contactName || sponsorName || "Partner"},

We are thrilled to welcome ${sponsorName || "your company"} as an official sponsor of Super Office Hours!
Your support directly powers founders and investors taking off from Tokyo.

Event Details:
September 25, 2026 · Dragon Gate, Shibuya, Tokyo
50 investors · 100 startups · 400 meetings

Package: ${safeSponsorName} Sponsorship
Total Paid: ${formattedAmount} JPY
${perksText}
Questions? Reply to this email — our partnership team is here to help.
© 2026 TAKEOFF tokyo. All rights reserved.`;

  return { html, text };
}

/**
 * Sends separate sponsor thanks email via Brevo Transactional Email API.
 */
export async function sendSponsorEmailWithBrevo(
  env,
  { to, sponsorName, contactName, amount = 0, description, perks },
  fetchFn = fetch
) {
  const apiKey = (env.BREVO_API_KEY || "").trim();
  if (!apiKey) {
    console.warn("[Brevo] Skipping sponsor email confirmation: BREVO_API_KEY is not set.");
    return null;
  }

  const senderEmail = env.BREVO_SENDER_EMAIL || "tickets@takeoff-tokyo.com";
  const senderName = env.BREVO_SENDER_NAME || "Super Office Hours";

  const { html, text } = buildSponsorEmail({
    sponsorName,
    contactName,
    amount,
    description,
    perks,
  });

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to, name: contactName || sponsorName || undefined }],
    subject: `Thank you for sponsoring Super Office Hours — ${sponsorName || "TAKEOFF tokyo"}`,
    htmlContent: html,
    textContent: text,
  };

  try {
    const res = await fetchFn("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Brevo] Failed to send sponsor email (HTTP ${res.status}): ${errBody}`);
      return null;
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[Brevo] Network error sending sponsor email:", err.message);
    return null;
  }
}

