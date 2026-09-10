import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatYen,
  escapeHtml,
  buildConfirmationEmail,
  sendConfirmationEmailWithBrevo,
} from "../functions/lib/email.js";
import { sendTicketConfirmation } from "../functions/api/stripe-webhook.js";

describe("Email Template Helper (functions/lib/email.js)", () => {
  it("formatYen formats numbers as JPY currency strings", () => {
    assert.equal(formatYen(0), "¥0");
    assert.equal(formatYen(50), "¥50");
    assert.equal(formatYen(2500), "¥2,500");
    assert.equal(formatYen(25000), "¥25,000");
  });

  it("escapeHtml escapes HTML entities correctly to prevent XSS", () => {
    const raw = '<script>alert("XSS & test\'s")</script>';
    const escaped = escapeHtml(raw);
    assert.equal(
      escaped,
      "&lt;script&gt;alert(&quot;XSS &amp; test&#39;s&quot;)&lt;/script&gt;"
    );
  });

  it("buildConfirmationEmail generates valid HTML and plain text with correct details", () => {
    const sampleData = {
      name: "Alice Tanaka",
      lineItems: [
        { description: "Startup ticket", quantity: 2, amount_total: 5000 },
        { description: "LP Dinner (Sep 24)", quantity: 1, amount_total: 25000 },
      ],
      totalAmount: 30000,
    };

    const { html, text } = buildConfirmationEmail(sampleData);

    // Verify HTML contents
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /Hi Alice Tanaka,/);
    assert.match(html, /Startup ticket &times; 2/);
    assert.match(html, /¥5,000/);
    assert.match(html, /LP Dinner \(Sep 24\) &times; 1/);
    assert.match(html, /¥25,000/);
    assert.match(html, /¥30,000/);
    assert.match(html, /Super Office Hours/);

    // Verify Plain text contents
    assert.match(text, /Hi Alice Tanaka,/);
    assert.match(text, /Startup ticket x2\s+¥5,000/);
    assert.match(text, /LP Dinner \(Sep 24\) x1\s+¥25,000/);
    assert.match(text, /Total\s+¥30,000/);
  });

  it("buildConfirmationEmail handles empty/missing name gracefully", () => {
    const sampleData = {
      name: "",
      lineItems: [{ description: "Startup ticket", quantity: 1, amount_total: 2500 }],
      totalAmount: 2500,
    };

    const { html, text } = buildConfirmationEmail(sampleData);
    assert.match(html, /Hi there,/);
    assert.match(text, /Hi there,/);
  });

  it("sendConfirmationEmailWithBrevo skips sending if BREVO_API_KEY is missing", async () => {
    const res = await sendConfirmationEmailWithBrevo({}, { to: "user@example.com" });
    assert.equal(res, null);
  });

  it("sendConfirmationEmailWithBrevo formats request and dispatches to Brevo API", async () => {
    let calledUrl = null;
    let calledOptions = null;

    const mockFetch = async (url, options) => {
      calledUrl = url;
      calledOptions = options;
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: "<brevo-msg-id-123@brevo.com>" }),
      };
    };

    const env = {
      BREVO_API_KEY: "xkeysib-test-api-key-999",
      BREVO_SENDER_EMAIL: "tickets@takeoff-tokyo.com",
      BREVO_SENDER_NAME: "Super Office Hours",
    };

    const result = await sendConfirmationEmailWithBrevo(
      env,
      {
        to: "attendee@example.com",
        name: "Kenji Sato",
        lineItems: [{ description: "Startup ticket", quantity: 1, amount_total: 2500 }],
        totalAmount: 2500,
      },
      mockFetch
    );

    assert.equal(calledUrl, "https://api.brevo.com/v3/smtp/email");
    assert.equal(calledOptions.method, "POST");
    assert.equal(calledOptions.headers["api-key"], "xkeysib-test-api-key-999");
    assert.equal(calledOptions.headers["Content-Type"], "application/json");

    const sentBody = JSON.parse(calledOptions.body);
    assert.deepEqual(sentBody.sender, { name: "Super Office Hours", email: "tickets@takeoff-tokyo.com" });
    assert.deepEqual(sentBody.to, [{ email: "attendee@example.com", name: "Kenji Sato" }]);
    assert.equal(sentBody.subject, "Your Super Office Hours ticket");
    assert.match(sentBody.htmlContent, /Hi Kenji Sato,/);
    assert.match(sentBody.textContent, /Hi Kenji Sato,/);

    assert.deepEqual(result, { messageId: "<brevo-msg-id-123@brevo.com>" });
  });
});

describe("Stripe Confirmation Sender (functions/api/stripe-webhook.js)", () => {
  it("sendTicketConfirmation skips sending if customer has no email", async () => {
    const mockStripe = {
      checkout: {
        sessions: {
          listLineItems: async () => ({ data: [] }),
        },
      },
    };
    const sessionWithoutEmail = { customer_email: null, customer_details: null };
    const result = await sendTicketConfirmation(mockStripe, {}, sessionWithoutEmail);
    assert.equal(result, null);
  });

  it("sendTicketConfirmation fetches line items and dispatches email via Brevo", async () => {
    let calledUrl = null;
    let calledOptions = null;

    const mockFetch = async (url, options) => {
      calledUrl = url;
      calledOptions = options;
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: "<brevo-confirm-id@takeoff-tokyo.com>" }),
      };
    };

    const mockStripe = {
      checkout: {
        sessions: {
          listLineItems: async (sessionId, opts) => {
            assert.equal(sessionId, "cs_test_123");
            assert.equal(opts.limit, 20);
            return {
              data: [
                { description: "Investor ticket", quantity: 1, amount_total: 5000 },
              ],
            };
          },
        },
      },
    };

    const mockEnv = {
      BREVO_API_KEY: "xkeysib-test-key",
      BREVO_SENDER_EMAIL: "tickets@takeoff-tokyo.com",
    };

    const mockSession = {
      id: "cs_test_123",
      customer_details: { email: "buyer@example.com" },
      metadata: { name: "Bob Sato" },
      amount_total: 5000,
    };

    const res = await sendTicketConfirmation(mockStripe, mockEnv, mockSession, {
      fetchFn: mockFetch,
    });

    assert.equal(res.messageId, "<brevo-confirm-id@takeoff-tokyo.com>");
    assert.equal(calledUrl, "https://api.brevo.com/v3/smtp/email");
    assert.equal(calledOptions.headers["api-key"], "xkeysib-test-key");

    const sentBody = JSON.parse(calledOptions.body);
    assert.deepEqual(sentBody.to, [{ email: "buyer@example.com", name: "Bob Sato" }]);
    assert.match(sentBody.htmlContent, /Hi Bob Sato,/);
  });
});
