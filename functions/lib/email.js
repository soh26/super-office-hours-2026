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

