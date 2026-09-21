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
export function buildSponsorEmail({ sponsorName, contactName, amount, description }) {
  const safeSponsorName = escapeHtml(sponsorName || "Valued Sponsor");
  const displayName = contactName ? escapeHtml(contactName) : safeSponsorName;
  const packageDesc = escapeHtml(description || "Super Office Hours Partnership & Sponsorship");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0c;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0c;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#1c1c22;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <div style="font-weight:700;font-size:15px;letter-spacing:-0.02em;color:#ffffff;">
                  TAKEOFF <span style="color:#2dd4bf;">tokyo</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0 32px;">
                <div style="display:inline-block;padding:4px 12px;border-radius:9999px;background:rgba(168,85,247,0.15);color:#c084fc;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                  Sponsor Confirmation
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0 32px;">
                <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.02em;">Thank you, ${safeSponsorName}!</h1>
                <p style="margin:6px 0 0 0;color:rgba(255,255,255,0.6);font-size:14px;">Super Office Hours &middot; September 25, 2026 &middot; Dragon Gate, Shibuya, Tokyo</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0 32px;">
                <p style="margin:0 0 14px 0;color:#ffffff;font-size:15px;line-height:1.6;">Dear ${displayName},</p>
                <p style="margin:0 0 14px 0;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
                  We are thrilled to welcome <strong>${safeSponsorName}</strong> as an official sponsor of Super Office Hours. Your support directly empowers the next generation of founders and investors taking off from Tokyo.
                </p>
                <p style="margin:0;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
                  Your sponsorship payment has been received and confirmed.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0 32px;">
                <div style="background:#141418;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px 20px;">
                  <div style="color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Sponsorship Summary</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:4px 0;color:rgba(255,255,255,0.7);font-size:14px;">${packageDesc}</td>
                      <td style="padding:4px 0;color:#ffffff;font-weight:700;font-size:15px;text-align:right;">${formatYen(amount)}</td>
                    </tr>
                    <tr>
                      <td style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);color:#ffffff;font-weight:700;font-size:15px;">Total Paid</td>
                      <td style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);color:#2dd4bf;font-weight:700;font-size:16px;text-align:right;">${formatYen(amount)}</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0 32px;">
                <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;">
                  <h3 style="margin:0 0 10px 0;color:#ffffff;font-size:15px;font-weight:700;">What happens next?</h3>
                  <ul style="margin:0;padding-left:18px;color:rgba(255,255,255,0.7);font-size:13px;line-height:1.7;">
                    <li>Our team will follow up directly regarding sponsor asset submissions (logos, bio, links).</li>
                    <li>We will issue your team's delegate passes and VIP check-in instructions.</li>
                    <li>If you require a Japanese qualified invoice / receipt (適格請求書), simply reply to this email.</li>
                  </ul>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 32px 32px;">
                <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;">
                  Have questions or special requests? Reply directly to this email or reach us at <a href="mailto:tickets@takeoff-tokyo.com" style="color:#2dd4bf;text-decoration:none;">tickets@takeoff-tokyo.com</a>.<br/>
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

  const text = `Super Office Hours — Sponsor Confirmation

Thank you, ${sponsorName || "Valued Sponsor"}!

Dear ${contactName || sponsorName || "Partner"},

We are thrilled to welcome ${sponsorName || "your company"} as an official sponsor of Super Office Hours!
Your support directly empowers the next generation of founders and investors taking off from Tokyo.

Event Details:
September 25, 2026 · Dragon Gate, Shibuya, Tokyo

Sponsorship Summary:
${description || "Super Office Hours Partnership & Sponsorship"}
Total Paid: ${formatYen(amount)}

What happens next?
- Our team will follow up directly regarding sponsor asset submissions (logos, bio, links).
- We will issue your team's delegate passes and VIP check-in instructions.
- If you require a Japanese qualified invoice / receipt (適格請求書), reply to this email.

Questions? Reply to this email — our partnership team is here to support you.
© 2026 TAKEOFF tokyo. All rights reserved.`;

  return { html, text };
}

/**
 * Sends separate sponsor thanks email via Brevo Transactional Email API.
 */
export async function sendSponsorEmailWithBrevo(
  env,
  { to, sponsorName, contactName, amount = 0, description },
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

