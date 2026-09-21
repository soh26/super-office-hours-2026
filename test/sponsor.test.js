import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildSponsorEmail, sendSponsorEmailWithBrevo } from "../functions/lib/email.js";
import {
  createSponsor,
  getSponsorBySlug,
  listSponsors,
  recordPaidSponsor,
} from "../functions/lib/supabase.js";
import { onRequestPost as verifyPost } from "../functions/api/admin/verify.js";
import {
  onRequestGet as adminSponsorsGet,
  onRequestPost as adminSponsorsPost,
} from "../functions/api/admin/sponsors.js";
import { onRequestPost as createSponsorCheckoutPost } from "../functions/api/create-sponsor-checkout.js";
import { onRequest as middlewareHandle } from "../functions/_middleware.js";
import { sendSponsorConfirmation } from "../functions/api/stripe-webhook.js";

describe("Sponsor Email Helper (functions/lib/email.js)", () => {
  test("buildSponsorEmail renders without implicit addons when no perks are provided", () => {
    const { html, text } = buildSponsorEmail({
      sponsorName: "Acme Corp <Japan>",
      contactName: "Alice Tanaka",
      amount: 500000,
    });

    // Verify HTML escaping and structure
    assert.match(html, /Acme Corp &lt;Japan&gt;/);
    assert.match(html, /Alice Tanaka/);
    assert.match(html, /Total Paid/);
    assert.match(html, /¥500,000/);
    assert.match(html, /Sponsor Confirmation/i);
    assert.doesNotMatch(html, /What happens next\?/);
    assert.doesNotMatch(html, /Full executive event access/);
    assert.doesNotMatch(html, /VIP networking &amp; matchmaking/);
    assert.doesNotMatch(html, /Value Checklist/);

    // Verify Plain Text
    assert.match(text, /Acme Corp <Japan>/);
    assert.match(text, /Total Paid: ¥500,000/);
    assert.match(text, /Super Office Hours/);
    assert.doesNotMatch(text, /What happens next\?/);
    assert.doesNotMatch(text, /Package Benefits:/);
    assert.doesNotMatch(text, /Full executive event access/);
  });

  test("buildSponsorEmail renders only explicit perks when provided", () => {
    const { html, text } = buildSponsorEmail({
      sponsorName: "Acme Corp",
      contactName: "Alice Tanaka",
      amount: 500000,
      perks: ["10 VIP tickets", "Exhibition booth at Dragon Gate"],
    });

    // Verify HTML has explicit perks and no hardcoded ones
    assert.match(html, /10 VIP tickets/);
    assert.match(html, /Exhibition booth at Dragon Gate/);
    assert.doesNotMatch(html, /Full executive event access/);

    // Verify plain text
    assert.match(text, /Package Benefits:/);
    assert.match(text, /✓ 10 VIP tickets/);
    assert.match(text, /✓ Exhibition booth at Dragon Gate/);
  });

  test("sendSponsorEmailWithBrevo dispatches payload to Brevo API", async () => {
    let capturedUrl = "";
    let capturedBody = null;
    let capturedHeaders = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      capturedHeaders = options.headers;
      return new Response(JSON.stringify({ messageId: "msg_sponsor_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const env = {
      BREVO_API_KEY: "test-brevo-key",
      BREVO_SENDER_EMAIL: "tickets@takeoff-tokyo.com",
      BREVO_SENDER_NAME: "Super Office Hours",
    };

    const res = await sendSponsorEmailWithBrevo(
      env,
      {
        to: "sponsor@acme.com",
        sponsorName: "Acme Corp",
        contactName: "Bob Smith",
        amount: 300000,
      },
      mockFetch
    );

    assert.equal(capturedUrl, "https://api.brevo.com/v3/smtp/email");
    assert.equal(capturedHeaders["api-key"], "test-brevo-key");
    assert.equal(capturedBody.to[0].email, "sponsor@acme.com");
    assert.equal(capturedBody.to[0].name, "Bob Smith");
    assert.match(capturedBody.subject, /Acme Corp/);
    assert.equal(res.messageId, "msg_sponsor_123");
  });
});

describe("Admin Verification & Sponsor Link Generation API", () => {
  const env = {
    SPONSOR_ADMIN_PASSWORD: "secret-test-password",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SECRET_KEY: "test-secret-key",
  };

  test("verify.js rejects invalid password and approves correct password", async () => {
    // 1. Missing password
    const reqEmpty = new Request("http://localhost:8787/api/admin/verify", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const resEmpty = await verifyPost({ env, request: reqEmpty });
    assert.equal(resEmpty.status, 400);

    // 2. Wrong password
    const reqWrong = new Request("http://localhost:8787/api/admin/verify", {
      method: "POST",
      body: JSON.stringify({ password: "wrong-password" }),
    });
    const resWrong = await verifyPost({ env, request: reqWrong });
    assert.equal(resWrong.status, 401);

    // 3. Correct password
    const reqCorrect = new Request("http://localhost:8787/api/admin/verify", {
      method: "POST",
      body: JSON.stringify({ password: "secret-test-password" }),
    });
    const resCorrect = await verifyPost({ env, request: reqCorrect });
    assert.equal(resCorrect.status, 200);
    const data = await resCorrect.json();
    assert.equal(data.success, true);
  });

  test("admin/sponsors.js creates custom sponsor link and returns custom URL", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url, options) => {
        // Mock getSponsorBySlug returning null (slug available)
        if (url.includes("/rest/v1/sponsors?slug=eq.")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        // Mock POST insert
        if (options && options.method === "POST" && url.includes("/rest/v1/sponsors")) {
          const body = JSON.parse(options.body);
          return new Response(JSON.stringify([{ ...body, id: "sp-123" }]), { status: 201 });
        }
        return new Response("Not found", { status: 404 });
      };

      const req = new Request("http://localhost:8787/api/admin/sponsors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-test-password",
        },
        body: JSON.stringify({
          name: "Tokyo Ventures",
          slug: "tokyo-ventures",
          amount: 500000,
          contactEmail: "partner@tokyovc.com",
        }),
      });

      const res = await adminSponsorsPost({ env, request: req });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.sponsor.name, "Tokyo Ventures");
      assert.equal(data.sponsor.slug, "tokyo-ventures");
      assert.equal(data.sponsor.amount, 500000);
      assert.equal(data.url, "http://localhost:8787/thanks-tokyo-ventures");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("admin/sponsors.js lists existing sponsors with full URLs", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify([
            { id: "1", name: "Alpha Capital", slug: "alpha-cap", amount: 1000000, status: "paid" },
            { id: "2", name: "Beta Corp", slug: "beta-corp", amount: 300000, status: "pending" },
          ]),
          { status: 200 }
        );
      };

      const req = new Request("http://localhost:8787/api/admin/sponsors", {
        headers: { Authorization: "Bearer secret-test-password" },
      });

      const res = await adminSponsorsGet({ env, request: req });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.sponsors.length, 2);
      assert.equal(data.sponsors[0].url, "http://localhost:8787/thanks-alpha-cap");
      assert.equal(data.sponsors[1].url, "http://localhost:8787/thanks-beta-corp");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Sponsor Checkout Flow (functions/api/create-sponsor-checkout.js)", () => {
  const env = {
    STRIPE_SECRET_KEY: "sk_test_sponsor_key",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SECRET_KEY: "test-secret-key",
  };

  test("initiates Stripe checkout session with predetermined sponsor amount and metadata", async () => {
    const originalFetch = globalThis.fetch;
    let stripeCapturedBody = null;

    try {
      globalThis.fetch = async (url, options) => {
        // 1. Supabase getSponsorBySlug
        if (url.includes("/rest/v1/sponsors?slug=eq.mega-corp")) {
          return new Response(
            JSON.stringify([
              {
                id: "sp-mega-999",
                name: "Mega Corp",
                slug: "mega-corp",
                amount: 750000,
                status: "pending",
                metadata: {
                  perks: ["5 Executive Badges", "Logo on Site"],
                },
              },
            ]),
            { status: 200 }
          );
        }
        // 2. Stripe Checkout session creation
        if (url.includes("api.stripe.com/v1/checkout/sessions")) {
          stripeCapturedBody = new URLSearchParams(options.body);
          return new Response(
            JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_sponsor_session" }),
            { status: 200 }
          );
        }
        return new Response("Not found", { status: 404 });
      };

      const req = new Request("http://localhost:8787/api/create-sponsor-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "mega-corp",
          name: "Ken Yamada",
          email: "yamada@megacorp.jp",
        }),
      });

      const res = await createSponsorCheckoutPost({ env, request: req });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.url, "https://checkout.stripe.com/c/pay/cs_test_sponsor_session");

      // Verify Stripe payload
      assert.equal(stripeCapturedBody.get("metadata[type]"), "sponsor");
      assert.equal(stripeCapturedBody.get("metadata[sponsor_id]"), "sp-mega-999");
      assert.equal(stripeCapturedBody.get("metadata[sponsor_slug]"), "mega-corp");
      assert.equal(stripeCapturedBody.get("metadata[sponsor_name]"), "Mega Corp");
      assert.equal(stripeCapturedBody.get("metadata[perks]"), JSON.stringify(["5 Executive Badges", "Logo on Site"]));
      assert.equal(stripeCapturedBody.get("line_items[0][price_data][unit_amount]"), "750000");
      assert.equal(stripeCapturedBody.get("line_items[0][price_data][currency]"), "jpy");
      assert.equal(
        stripeCapturedBody.get("success_url"),
        "http://localhost:8787/thanks-mega-corp?paid=1&session_id={CHECKOUT_SESSION_ID}"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("blocks checkout if sponsor package is already paid", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url) => {
        if (url.includes("/rest/v1/sponsors?slug=eq.already-paid")) {
          return new Response(
            JSON.stringify([
              {
                id: "sp-paid-1",
                name: "Already Paid Partner",
                slug: "already-paid",
                amount: 300000,
                status: "paid",
              },
            ]),
            { status: 200 }
          );
        }
        return new Response("Not found", { status: 404 });
      };

      const req = new Request("http://localhost:8787/api/create-sponsor-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "already-paid",
          email: "partner@corp.com",
        }),
      });

      const res = await createSponsorCheckoutPost({ env, request: req });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /already been paid/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Cloudflare Middleware Dynamic Sponsor Route (functions/_middleware.js)", () => {
  const env = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SECRET_KEY: "test-secret-key",
  };

  test("intercepts /thanks-acme and renders sponsor ticket box with custom amount", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url) => {
        if (url.includes("/rest/v1/sponsors?slug=eq.acme-corp")) {
          return new Response(
            JSON.stringify([
              {
                id: "sp-acme",
                name: "Acme Corporation",
                slug: "acme-corp",
                amount: 450000,
                status: "pending",
              },
            ]),
            { status: 200 }
          );
        }
        return new Response("[]", { status: 200 });
      };

      const req = new Request("http://localhost:8787/thanks-acme-corp");
      const nextCalled = false;
      const context = {
        request: req,
        env,
        next: () => {
          throw new Error("Next should not be called for sponsor route");
        },
      };

      const res = await middlewareHandle(context);
      assert.equal(res.status, 200);
      assert.match(res.headers.get("Content-Type"), /text\/html/);
      const html = await res.text();
      assert.match(html, /Acme Corporation/);
      assert.match(html, /¥450,000/);
      assert.match(html, /Proceed to Stripe Checkout/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("renders 404 page if sponsor slug is not found", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => new Response("[]", { status: 200 });

      const req = new Request("http://localhost:8787/thanks-unknown-sponsor");
      const context = {
        request: req,
        env: { ...env, DEBUG: "false" },
        next: () => {
          throw new Error("Next should not be called");
        },
      };

      const res = await middlewareHandle(context);
      assert.equal(res.status, 404);
      const html = await res.text();
      assert.match(html, /Sponsorship Link Not Found/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("passes non-sponsor routes to context.next()", async () => {
    const req = new Request("http://localhost:8787/about");
    let nextCalled = false;
    const context = {
      request: req,
      env,
      next: async () => {
        nextCalled = true;
        return new Response("Home page");
      },
    };

    const res = await middlewareHandle(context);
    assert.equal(nextCalled, true);
    assert.equal(await res.text(), "Home page");
  });
});

describe("Sponsor Webhook Confirmation (functions/api/stripe-webhook.js)", () => {
  test("sendSponsorConfirmation formats and sends dedicated email", async () => {
    let emailDispatched = false;

    const mockFetch = async (url, options) => {
      emailDispatched = true;
      const body = JSON.parse(options.body);
      assert.equal(body.to[0].email, "partner@sponsor.com");
      assert.match(body.subject, /Acme Co/);
      assert.match(body.htmlContent, /Stage Mention/);
      assert.match(body.textContent, /Stage Mention/);
      return new Response(JSON.stringify({ messageId: "msg_webhook_sponsor" }), { status: 200 });
    };

    const env = {
      BREVO_API_KEY: "test-brevo-key",
    };

    const session = {
      id: "cs_sponsor_webhook_123",
      amount_total: 600000,
      customer_email: "partner@sponsor.com",
      metadata: {
        type: "sponsor",
        sponsor_name: "Acme Co",
        name: "Jane Doe",
        perks: JSON.stringify(["Stage Mention"]),
      },
    };

    await sendSponsorConfirmation(env, session, { fetchFn: mockFetch });
    assert.equal(emailDispatched, true);
  });
});
