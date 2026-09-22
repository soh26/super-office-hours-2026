import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildSponsorEmail, formatCurrency, sendSponsorEmailWithBrevo } from "../functions/lib/email.js";
import {
  createSponsor,
  deletePendingSponsor,
  getSponsorById,
  getSponsorBySlug,
  getSponsorViews,
  listSponsors,
  recordPaidSponsor,
  recordSponsorView,
  updatePendingSponsor,
} from "../functions/lib/supabase.js";
import { onRequestPost as verifyPost } from "../functions/api/admin/verify.js";
import {
  onRequestDelete as adminSponsorsDelete,
  onRequestGet as adminSponsorsGet,
  onRequestPatch as adminSponsorsPatch,
  onRequestPost as adminSponsorsPost,
  onRequestPut as adminSponsorsPut,
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

  test("admin/sponsors.js PUT updates pending sponsor and returns updated custom URL", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url, options) => {
        // Mock PATCH update
        if (options && options.method === "PATCH") {
          const body = JSON.parse(options.body);
          return new Response(JSON.stringify([{ id: "sp-123", status: "pending", ...body }]), {
            status: 200,
          });
        }
        // Mock getSponsorById returning pending sponsor
        if (url.includes("/rest/v1/sponsors?id=eq.sp-123")) {
          return new Response(
            JSON.stringify([
              {
                id: "sp-123",
                name: "Old Name",
                slug: "old-slug",
                amount: 300000,
                status: "pending",
                metadata: { perks: [] },
              },
            ]),
            { status: 200 }
          );
        }
        // Mock getSponsorBySlug for new slug check
        if (url.includes("/rest/v1/sponsors?slug=eq.new-slug")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response("Not found", { status: 404 });
      };

      const req = new Request("http://localhost:8787/api/admin/sponsors", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-test-password",
        },
        body: JSON.stringify({
          id: "sp-123",
          name: "Updated Name",
          slug: "new-slug",
          amount: 600000,
          perks: ["VIP Lounge Access"],
        }),
      });

      const res = await adminSponsorsPut({ env, request: req });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.sponsor.name, "Updated Name");
      assert.equal(data.sponsor.slug, "new-slug");
      assert.equal(data.sponsor.amount, 600000);
      assert.equal(data.url, "http://localhost:8787/thanks-new-slug");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("admin/sponsors.js PUT rejects modifying a paid sponsor", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url) => {
        if (url.includes("/rest/v1/sponsors?id=eq.sp-paid")) {
          return new Response(
            JSON.stringify([
              {
                id: "sp-paid",
                name: "Paid Sponsor",
                slug: "paid-slug",
                amount: 1000000,
                status: "paid",
              },
            ]),
            { status: 200 }
          );
        }
        return new Response("Not found", { status: 404 });
      };

      const req = new Request("http://localhost:8787/api/admin/sponsors", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-test-password",
        },
        body: JSON.stringify({
          id: "sp-paid",
          name: "Attempted Update",
        }),
      });

      const res = await adminSponsorsPut({ env, request: req });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /already been paid/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("admin/sponsors.js DELETE deletes a pending sponsor", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url, options) => {
        if (url.includes("/rest/v1/sponsors?id=eq.sp-del-1")) {
          if (options && options.method === "DELETE") {
            return new Response(JSON.stringify([{ id: "sp-del-1", status: "pending" }]), { status: 200 });
          }
          return new Response(
            JSON.stringify([{ id: "sp-del-1", name: "To Delete", status: "pending" }]),
            { status: 200 }
          );
        }
        return new Response("Not found", { status: 404 });
      };

      const req = new Request("http://localhost:8787/api/admin/sponsors?id=sp-del-1", {
        method: "DELETE",
        headers: { Authorization: "Bearer secret-test-password" },
      });

      const res = await adminSponsorsDelete({ env, request: req });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("admin/sponsors.js DELETE rejects deleting a paid sponsor", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url) => {
        if (url.includes("/rest/v1/sponsors?id=eq.sp-paid-del")) {
          return new Response(
            JSON.stringify([{ id: "sp-paid-del", name: "Paid Sponsor", status: "paid" }]),
            { status: 200 }
          );
        }
        return new Response("Not found", { status: 404 });
      };

      const req = new Request("http://localhost:8787/api/admin/sponsors?id=sp-paid-del", {
        method: "DELETE",
        headers: { Authorization: "Bearer secret-test-password" },
      });

      const res = await adminSponsorsDelete({ env, request: req });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /already been paid/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Supabase Sponsor CRUD Operations (functions/lib/supabase.js)", () => {
  const env = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SECRET_KEY: "test-secret-key",
  };

  test("updatePendingSponsor refuses to update a paid sponsor", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify([{ id: "sp-1", status: "paid" }]), { status: 200 });
    const res = await updatePendingSponsor(env, "sp-1", { name: "New Name" }, mockFetch);
    assert.equal(res.status, 400);
    assert.match(res.error, /already been paid/i);
  });

  test("deletePendingSponsor refuses to delete a paid sponsor", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify([{ id: "sp-1", status: "paid" }]), { status: 200 });
    const res = await deletePendingSponsor(env, "sp-1", mockFetch);
    assert.equal(res.status, 400);
    assert.match(res.error, /already been paid/i);
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

describe("Multi-Currency Support for Sponsors (JPY, USD, EUR)", () => {
  const env = {
    SPONSOR_ADMIN_PASSWORD: "secret-test-password",
    STRIPE_SECRET_KEY: "sk_test_currency_key",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SECRET_KEY: "test-secret-key",
  };

  test("formatCurrency handles JPY, USD, and EUR accurately", () => {
    assert.equal(formatCurrency(500000, "jpy"), "¥500,000");
    assert.equal(formatCurrency(5000, "usd"), "$5,000");
    assert.equal(formatCurrency(3500, "eur"), "€3,500");
    // Defaults to JPY if currency not passed or empty
    assert.equal(formatCurrency(100000), "¥100,000");
  });

  test("buildSponsorEmail renders USD and EUR currency symbols and labels", () => {
    const usdResult = buildSponsorEmail({
      sponsorName: "Silicon Valley Angels",
      contactName: "David Lee",
      amount: 10000,
      currency: "usd",
      perks: ["Keynote Intro"],
    });
    assert.match(usdResult.html, /\$10,000/);
    assert.match(usdResult.html, /USD/);
    assert.match(usdResult.text, /Total Paid: \$10,000 USD/);

    const eurResult = buildSponsorEmail({
      sponsorName: "Berlin Ventures",
      contactName: "Klaus Schmidt",
      amount: 4500,
      currency: "eur",
    });
    assert.match(eurResult.html, /€4,500/);
    assert.match(eurResult.html, /EUR/);
    assert.match(eurResult.text, /Total Paid: €4,500 EUR/);
  });

  test("admin/sponsors.js POST validates currency and rejects unsupported currencies", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url) => {
        if (url.includes("/rest/v1/sponsors?slug=eq.global-fund")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes("/rest/v1/sponsors")) {
          return new Response(JSON.stringify([{ id: "sp-usd-1", name: "Global Fund", currency: "usd" }]), {
            status: 201,
          });
        }
        return new Response("Not found", { status: 404 });
      };

      // Valid USD
      const validReq = new Request("http://localhost:8787/api/admin/sponsors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-test-password",
        },
        body: JSON.stringify({
          name: "Global Fund",
          amount: 5000,
          currency: "usd",
        }),
      });
      const validRes = await adminSponsorsPost({ env, request: validReq });
      assert.equal(validRes.status, 201);
      const validData = await validRes.json();
      assert.equal(validData.sponsor.currency, "usd");

      // Invalid Currency (e.g. GBP)
      const invalidReq = new Request("http://localhost:8787/api/admin/sponsors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-test-password",
        },
        body: JSON.stringify({
          name: "British Tech",
          amount: 5000,
          currency: "gbp",
        }),
      });
      const invalidRes = await adminSponsorsPost({ env, request: invalidReq });
      assert.equal(invalidRes.status, 400);
      const invalidData = await invalidRes.json();
      assert.match(invalidData.error, /Supported currencies are JPY, USD, and EUR/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("create-sponsor-checkout sets Stripe unit_amount in cents for USD and EUR, unmultiplied for JPY", async () => {
    const originalFetch = globalThis.fetch;
    let capturedStripeParams = null;

    try {
      globalThis.fetch = async (url, options) => {
        if (url.includes("/rest/v1/sponsors?slug=eq.usd-partner")) {
          return new Response(
            JSON.stringify([
              {
                id: "sp-usd-123",
                name: "USD Partner",
                slug: "usd-partner",
                amount: 5000, // $5,000
                currency: "usd",
                status: "pending",
              },
            ]),
            { status: 200 }
          );
        }
        if (url.includes("/rest/v1/sponsors?slug=eq.eur-partner")) {
          return new Response(
            JSON.stringify([
              {
                id: "sp-eur-123",
                name: "EUR Partner",
                slug: "eur-partner",
                amount: 3200, // €3,200
                currency: "eur",
                status: "pending",
              },
            ]),
            { status: 200 }
          );
        }
        if (url.includes("api.stripe.com/v1/checkout/sessions")) {
          capturedStripeParams = new URLSearchParams(options.body);
          return new Response(
            JSON.stringify({ url: "https://checkout.stripe.com/pay/cs_test" }),
            { status: 200 }
          );
        }
        return new Response("Not found", { status: 404 });
      };

      // 1. USD checkout (5000 USD -> 500000 cents)
      const usdReq = new Request("http://localhost:8787/api/create-sponsor-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "usd-partner",
          name: "John Doe",
          email: "john@usdpartner.com",
        }),
      });
      const usdRes = await createSponsorCheckoutPost({ env, request: usdReq });
      assert.equal(usdRes.status, 200);
      assert.equal(capturedStripeParams.get("line_items[0][price_data][currency]"), "usd");
      assert.equal(capturedStripeParams.get("line_items[0][price_data][unit_amount]"), "500000");
      assert.equal(capturedStripeParams.get("metadata[currency]"), "usd");

      // 2. EUR checkout (3200 EUR -> 320000 cents)
      const eurReq = new Request("http://localhost:8787/api/create-sponsor-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "eur-partner",
          name: "Pierre Laurent",
          email: "pierre@eurpartner.fr",
        }),
      });
      const eurRes = await createSponsorCheckoutPost({ env, request: eurReq });
      assert.equal(eurRes.status, 200);
      assert.equal(capturedStripeParams.get("line_items[0][price_data][currency]"), "eur");
      assert.equal(capturedStripeParams.get("line_items[0][price_data][unit_amount]"), "320000");
      assert.equal(capturedStripeParams.get("metadata[currency]"), "eur");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("middleware renders custom USD and EUR currency symbols on sponsor landing page", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url) => {
        if (url.includes("/rest/v1/sponsors?slug=eq.usd-global")) {
          return new Response(
            JSON.stringify([
              {
                id: "sp-usd-99",
                name: "USD Global",
                slug: "usd-global",
                amount: 7500,
                currency: "usd",
                status: "pending",
                description: "Executive Partner",
              },
            ]),
            { status: 200 }
          );
        }
        return new Response("Not found", { status: 404 });
      };

      const req = new Request("http://localhost:8787/thanks-usd-global");
      const res = await middlewareHandle({ request: req, env, next: async () => {} });
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /\$7,500/);
      assert.match(html, /USD/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("sendSponsorConfirmation converts USD cents from Stripe session to standard currency unit for email", async () => {
    let capturedEmail = null;
    const mockFetch = async (url, options) => {
      capturedEmail = JSON.parse(options.body);
      return new Response(JSON.stringify({ messageId: "msg_curr_123" }), { status: 200 });
    };

    const session = {
      id: "cs_usd_123",
      amount_total: 500000, // 500,000 cents in Stripe
      currency: "usd",
      customer_email: "sponsor@usd.com",
      metadata: {
        sponsor_name: "American Capital",
        name: "Sarah Connor",
      },
    };

    await sendSponsorConfirmation(
      { ...env, BREVO_API_KEY: "test-brevo-key" },
      session,
      { fetchFn: mockFetch }
    );
    assert.ok(capturedEmail);
    // Email should show $5,000 USD, not $500,000
    assert.match(capturedEmail.htmlContent, /\$5,000/);
    assert.match(capturedEmail.htmlContent, /USD/);
    assert.match(capturedEmail.textContent, /\$5,000 USD/);
  });
});

describe("Sponsor Access Logs & Geolocation (Timestamp & City)", () => {
  const env = {
    SPONSOR_ADMIN_PASSWORD: "secret-test-password",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SECRET_KEY: "test-secret-key",
  };

  test("recordSponsorView stores timestamp and city in database and updates metadata", async () => {
    let capturedViewsPost = null;
    let capturedSponsorPatch = null;

    const mockFetch = async (url, options) => {
      if (url.includes("/rest/v1/sponsor_views")) {
        capturedViewsPost = JSON.parse(options.body);
        return new Response(JSON.stringify([{ id: "view-1" }]), { status: 201 });
      }
      if (url.includes("/rest/v1/sponsors?id=eq.sp-geo-1")) {
        capturedSponsorPatch = JSON.parse(options.body);
        return new Response(JSON.stringify([{ id: "sp-geo-1" }]), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    const mockSponsor = {
      id: "sp-geo-1",
      slug: "geo-sponsor",
      metadata: {
        view_count: 2,
        views: [{ timestamp: "2026-09-22T08:00:00Z", city: "Yokohama", country: "JP" }],
      },
    };

    const result = await recordSponsorView(
      env,
      {
        sponsor: mockSponsor,
        sponsorId: "sp-geo-1",
        slug: "geo-sponsor",
        city: "Tokyo",
        country: "JP",
        timestamp: "2026-09-22T09:00:00Z",
      },
      mockFetch
    );

    assert.equal(result.success, true);
    assert.equal(result.city, "Tokyo");
    assert.equal(result.timestamp, "2026-09-22T09:00:00Z");

    // Verify insert into sponsor_views table
    assert.ok(capturedViewsPost);
    assert.equal(capturedViewsPost.sponsor_id, "sp-geo-1");
    assert.equal(capturedViewsPost.sponsor_slug, "geo-sponsor");
    assert.equal(capturedViewsPost.city, "Tokyo");
    assert.equal(capturedViewsPost.country, "JP");
    assert.equal(capturedViewsPost.viewed_at, "2026-09-22T09:00:00Z");

    // Verify metadata update in sponsors table
    assert.ok(capturedSponsorPatch);
    assert.equal(capturedSponsorPatch.metadata.view_count, 3);
    assert.equal(capturedSponsorPatch.metadata.views.length, 2);
    assert.equal(capturedSponsorPatch.metadata.views[0].city, "Tokyo");
    assert.equal(capturedSponsorPatch.metadata.views[0].timestamp, "2026-09-22T09:00:00Z");
  });

  test("getSponsorViews retrieves logs from sponsor_views or metadata fallback", async () => {
    // 1. From sponsor_views table
    const mockFetchTable = async (url) => {
      if (url.includes("/rest/v1/sponsor_views")) {
        return new Response(
          JSON.stringify([
            { viewed_at: "2026-09-22T10:00:00Z", city: "Shibuya", country: "JP" },
            { viewed_at: "2026-09-22T09:30:00Z", city: "Osaka", country: "JP" },
          ]),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const tableViews = await getSponsorViews(env, "shibuya-partner", mockFetchTable);
    assert.equal(tableViews.length, 2);
    assert.equal(tableViews[0].city, "Shibuya");
    assert.equal(tableViews[0].timestamp, "2026-09-22T10:00:00Z");

    // 2. Fallback to sponsor.metadata.views when sponsor_views table returns 404
    const mockFetchFallback = async (url) => {
      if (url.includes("/rest/v1/sponsor_views")) {
        return new Response("Not found", { status: 404 });
      }
      if (url.includes("/rest/v1/sponsors?slug=eq.fallback-partner")) {
        return new Response(
          JSON.stringify([
            {
              id: "sp-fb",
              slug: "fallback-partner",
              metadata: {
                views: [{ timestamp: "2026-09-22T07:15:00Z", city: "Nagoya", country: "JP" }],
              },
            },
          ]),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const fallbackViews = await getSponsorViews(env, "fallback-partner", mockFetchFallback);
    assert.equal(fallbackViews.length, 1);
    assert.equal(fallbackViews[0].city, "Nagoya");
  });

  test("middleware intercepts sponsor link and logs city from Cloudflare cf object", async () => {
    const originalFetch = globalThis.fetch;
    let loggedCity = null;

    try {
      globalThis.fetch = async (url, options) => {
        if (url.includes("/rest/v1/sponsors?slug=eq.cf-geo-test")) {
          return new Response(
            JSON.stringify([
              {
                id: "sp-cf-1",
                name: "CF Geo Partner",
                slug: "cf-geo-test",
                amount: 250000,
                status: "pending",
                metadata: {},
              },
            ]),
            { status: 200 }
          );
        }
        if (url.includes("/rest/v1/sponsor_views")) {
          const body = JSON.parse(options.body);
          loggedCity = body.city;
          return new Response(JSON.stringify([{ id: "v-1" }]), { status: 201 });
        }
        if (url.includes("/rest/v1/sponsors?id=eq.sp-cf-1")) {
          return new Response(JSON.stringify([{ id: "sp-cf-1" }]), { status: 200 });
        }
        return new Response("Not found", { status: 404 });
      };

      const req = new Request("http://localhost:8787/thanks-cf-geo-test");
      const context = {
        request: req,
        env,
        next: async () => {},
      };
      // Cloudflare cf object with city
      context.request.cf = { city: "Kyoto", country: "JP" };

      const res = await middlewareHandle(context);
      assert.equal(res.status, 200);
      assert.equal(loggedCity, "Kyoto");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("middleware falls back to cf-ipcity header if cf object is not present", async () => {
    const originalFetch = globalThis.fetch;
    let loggedCity = null;

    try {
      globalThis.fetch = async (url, options) => {
        if (url.includes("/rest/v1/sponsors?slug=eq.header-geo-test")) {
          return new Response(
            JSON.stringify([
              {
                id: "sp-header-1",
                name: "Header Geo Partner",
                slug: "header-geo-test",
                amount: 300000,
                status: "pending",
                metadata: {},
              },
            ]),
            { status: 200 }
          );
        }
        if (url.includes("/rest/v1/sponsor_views")) {
          const body = JSON.parse(options.body);
          loggedCity = body.city;
          return new Response(JSON.stringify([{ id: "v-2" }]), { status: 201 });
        }
        if (url.includes("/rest/v1/sponsors?id=eq.sp-header-1")) {
          return new Response(JSON.stringify([{ id: "sp-header-1" }]), { status: 200 });
        }
        return new Response("Not found", { status: 404 });
      };

      const req = new Request("http://localhost:8787/thanks-header-geo-test", {
        headers: {
          "cf-ipcity": "San Francisco",
          "cf-ipcountry": "US",
        },
      });

      const res = await middlewareHandle({ request: req, env, next: async () => {} });
      assert.equal(res.status, 200);
      assert.equal(loggedCity, "San Francisco");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("admin/sponsors.js GET returns view_count and views in list, and handles ?logs= query", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url) => {
        // List sponsors
        if (url.includes("/rest/v1/sponsors?order=created_at.desc")) {
          return new Response(
            JSON.stringify([
              {
                id: "sp-logs-1",
                name: "Logged Partner",
                slug: "logged-partner",
                amount: 500000,
                currency: "jpy",
                status: "pending",
                metadata: {
                  view_count: 5,
                  views: [{ timestamp: "2026-09-22T12:00:00Z", city: "Tokyo", country: "JP" }],
                },
              },
            ]),
            { status: 200 }
          );
        }
        // Specific logs query
        if (url.includes("/rest/v1/sponsor_views")) {
          return new Response(
            JSON.stringify([
              { viewed_at: "2026-09-22T12:00:00Z", city: "Tokyo", country: "JP" },
              { viewed_at: "2026-09-22T11:00:00Z", city: "Osaka", country: "JP" },
            ]),
            { status: 200 }
          );
        }
        return new Response("Not found", { status: 404 });
      };

      // 1. List sponsors includes view_count and views
      const listReq = new Request("http://localhost:8787/api/admin/sponsors", {
        headers: { Authorization: "Bearer secret-test-password" },
      });
      const listRes = await adminSponsorsGet({ env, request: listReq });
      assert.equal(listRes.status, 200);
      const listData = await listRes.json();
      assert.equal(listData.sponsors[0].view_count, 5);
      assert.equal(listData.sponsors[0].views.length, 1);
      assert.equal(listData.sponsors[0].views[0].city, "Tokyo");

      // 2. Query logs specifically
      const logsReq = new Request("http://localhost:8787/api/admin/sponsors?logs=sp-logs-1", {
        headers: { Authorization: "Bearer secret-test-password" },
      });
      const logsRes = await adminSponsorsGet({ env, request: logsReq });
      assert.equal(logsRes.status, 200);
      const logsData = await logsRes.json();
      assert.equal(logsData.views.length, 2);
      assert.equal(logsData.views[0].city, "Tokyo");
      assert.equal(logsData.views[1].city, "Osaka");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});


