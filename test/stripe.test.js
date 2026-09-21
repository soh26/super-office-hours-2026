import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { onRequestOptions, onRequestPost as createCheckoutPost } from "../functions/api/create-checkout.js";
import { onRequestPost as webhookPost } from "../functions/api/stripe-webhook.js";

describe("Stripe Checkout Creation & Redirects (functions/api/create-checkout.js)", () => {
  it("onRequestOptions returns 204 No Content with CORS headers", async () => {
    const res = await onRequestOptions();
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
    assert.equal(res.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  });

  it("fails with 500 if STRIPE_SECRET_KEY is missing", async () => {
    const context = {
      env: {},
      request: new Request("http://localhost:8787/api/create-checkout", {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
      }),
    };
    const res = await createCheckoutPost(context);
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.match(body.error, /STRIPE_SECRET_KEY is not set/);
  });

  it("fails with 400 if email is missing or empty", async () => {
    const context = {
      env: { STRIPE_SECRET_KEY: "sk_test_123" },
      request: new Request("http://localhost:8787/api/create-checkout", {
        method: "POST",
        body: JSON.stringify({ email: "", qty: { startup: 1 } }),
      }),
    };
    const res = await createCheckoutPost(context);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Email required");
  });

  it("fails with 400 if no tickets are selected", async () => {
    const context = {
      env: { STRIPE_SECRET_KEY: "sk_test_123" },
      request: new Request("http://localhost:8787/api/create-checkout", {
        method: "POST",
        body: JSON.stringify({ email: "buyer@example.com", qty: { startup: 0, investor: 0 } }),
      }),
    };
    const res = await createCheckoutPost(context);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "No tickets selected");
  });

  it("rejects test_taro tickets when in production mode (sk_live_...)", async () => {
    const context = {
      env: { STRIPE_SECRET_KEY: "sk_live_real_key_123" },
      request: new Request("https://soh.takeoff-tokyo.com/api/create-checkout", {
        method: "POST",
        body: JSON.stringify({ email: "buyer@example.com", qty: { test_taro: 1 } }),
      }),
    };
    const res = await createCheckoutPost(context);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Test tickets are disabled in production");
  });

  it("allows test_taro ticket (50 JPY) with sk_live_ key when DEBUG=true is set in env", async () => {
    let capturedStripePayload = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (typeof url === "string" && url.includes("api.stripe.com/v1/checkout/sessions")) {
        capturedStripePayload = new URLSearchParams(options.body);
        return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_live_sample" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, options);
    };

    try {
      const context = {
        env: {
          STRIPE_SECRET_KEY: "sk_live_real_key_123",
          DEBUG: "true",
        },
        request: new Request("https://preview.shipping-test.soh.takeoff-tokyo.com/api/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "tester@takeoff-tokyo.com", qty: { test_taro: 1 } }),
        }),
      };
      const res = await createCheckoutPost(context);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.url, "https://checkout.stripe.com/c/pay/cs_live_sample");

      // Verify line item unit_amount is 50 JPY
      assert.equal(capturedStripePayload.get("line_items[0][quantity]"), "1");
      assert.equal(capturedStripePayload.get("line_items[0][price_data][unit_amount]"), "50");
      assert.equal(capturedStripePayload.get("line_items[0][price_data][currency]"), "jpy");
      assert.equal(capturedStripePayload.get("line_items[0][price_data][product_data][name]"), "Taro ticket");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("builds correct success_url, cancel_url and Stripe metadata based on request origin", async () => {
    let capturedStripePayload = null;
    let capturedStripeHeaders = null;

    // Mock global fetch for Stripe Checkout Sessions API
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (typeof url === "string" && url.includes("api.stripe.com/v1/checkout/sessions")) {
        capturedStripePayload = new URLSearchParams(options.body);
        capturedStripeHeaders = options.headers;
        return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_sample" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, options);
    };

    try {
      const origin = "http://localhost:8787";
      const context = {
        env: {
          STRIPE_SECRET_KEY: "sk_test_mock_123",
        },
        request: new Request(`${origin}/api/create-checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 TestBrowser",
            Referer: `${origin}/`,
          },
          body: JSON.stringify({
            registrationId: "custom-reg-id-999",
            email: "founder@startup.io",
            name: "Ken Sato",
            company: "NextGen AI",
            role: "Founder",
            qty: { startup: 2, investor: 0 },
            lpDinner: false,
            questionnaire: { stage: "Series A" },
          }),
        }),
      };

      const res = await createCheckoutPost(context);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.url, "https://checkout.stripe.com/c/pay/cs_test_sample");

      // Verify dynamic redirect URLs
      assert.equal(
        capturedStripePayload.get("success_url"),
        `${origin}/?paid=1&session_id={CHECKOUT_SESSION_ID}`
      );
      assert.equal(capturedStripePayload.get("cancel_url"), `${origin}/?canceled=1`);

      // Verify customer details and metadata passed to Stripe
      assert.equal(capturedStripePayload.get("customer_email"), "founder@startup.io");
      assert.equal(capturedStripePayload.get("metadata[registration_id]"), "custom-reg-id-999");
      assert.equal(capturedStripePayload.get("metadata[name]"), "Ken Sato");
      assert.equal(capturedStripePayload.get("metadata[company]"), "NextGen AI");
      assert.equal(capturedStripePayload.get("metadata[role]"), "Founder");
      assert.equal(capturedStripePayload.get("metadata[email]"), "founder@startup.io");

      // Verify line items (Startup ticket x 2 @ ¥3000 each)
      assert.equal(capturedStripePayload.get("line_items[0][quantity]"), "2");
      assert.equal(capturedStripePayload.get("line_items[0][price_data][unit_amount]"), "3000");
      assert.equal(capturedStripePayload.get("line_items[0][price_data][currency]"), "jpy");
      assert.equal(capturedStripePayload.get("line_items[0][price_data][product_data][name]"), "Startup ticket");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Stripe Webhook Verification & Processing (functions/api/stripe-webhook.js)", () => {
  const secretKey = "sk_test_mock_webhook_key";
  const webhookSecret = "whsec_test_secret_for_unit_tests_1234567890";
  const stripe = new Stripe(secretKey);

  it("returns 500 if Stripe environment variables are missing", async () => {
    const context = {
      env: {},
      request: new Request("http://localhost:8787/api/stripe-webhook", {
        method: "POST",
        body: "{}",
      }),
    };
    const res = await webhookPost(context);
    assert.equal(res.status, 500);
  });

  it("returns 400 if Stripe signature is invalid or tampered", async () => {
    const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });
    const context = {
      env: {
        STRIPE_SECRET_KEY: secretKey,
        STRIPE_WEBHOOK_SECRET: webhookSecret,
      },
      request: new Request("http://localhost:8787/api/stripe-webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "t=12345,v1=invalid_tampered_signature_hex",
        },
        body: payload,
      }),
    };
    const res = await webhookPost(context);
    assert.equal(res.status, 400);
    const text = await res.text();
    assert.match(text, /Webhook signature verification failed/);
  });

  it("successfully validates signed payload and handles checkout.session.completed", async () => {
    const sessionObj = {
      id: "cs_test_complete_123",
      payment_intent: "pi_test_123",
      customer: "cus_test_123",
      customer_details: { email: "paid-attendee@example.com", name: "Hiro Tanaka" },
      amount_total: 5000,
      currency: "jpy",
      metadata: {
        registration_id: "reg-uuid-1234",
        name: "Hiro Tanaka",
        company: "Tokyo Ventures",
      },
    };

    const eventPayload = JSON.stringify({
      id: "evt_test_checkout_completed",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: sessionObj,
      },
    });

    // Generate valid Stripe signature header
    const validHeader = stripe.webhooks.generateTestHeaderString({
      payload: eventPayload,
      secret: webhookSecret,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      // Mock Stripe listLineItems call
      if (typeof url === "string" && url.includes("/v1/checkout/sessions/cs_test_complete_123/line_items")) {
        return new Response(
          JSON.stringify({
            data: [{ description: "Investor ticket", quantity: 1, amount_total: 5000 }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, options);
    };

    try {
      const context = {
        env: {
          STRIPE_SECRET_KEY: secretKey,
          STRIPE_WEBHOOK_SECRET: webhookSecret,
        },
        request: new Request("http://localhost:8787/api/stripe-webhook", {
          method: "POST",
          headers: {
            "stripe-signature": validHeader,
          },
          body: eventPayload,
        }),
      };

      const res = await webhookPost(context);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.deepEqual(data, { received: true });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles other webhook event types gracefully (e.g. payment_intent.succeeded)", async () => {
    const eventPayload = JSON.stringify({
      id: "evt_test_other",
      object: "event",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_123" } },
    });

    const validHeader = stripe.webhooks.generateTestHeaderString({
      payload: eventPayload,
      secret: webhookSecret,
    });

    const context = {
      env: {
        STRIPE_SECRET_KEY: secretKey,
        STRIPE_WEBHOOK_SECRET: webhookSecret,
      },
      request: new Request("http://localhost:8787/api/stripe-webhook", {
        method: "POST",
        headers: {
          "stripe-signature": validHeader,
        },
        body: eventPayload,
      }),
    };

    const res = await webhookPost(context);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data, { received: true });
  });
});
