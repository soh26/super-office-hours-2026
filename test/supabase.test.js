import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPendingRegistration, recordPaidRegistration } from "../functions/lib/supabase.js";

describe("Supabase Helper (functions/lib/supabase.js)", () => {
  it("createPendingRegistration returns null if env vars are missing", async () => {
    const res = await createPendingRegistration({}, { name: "Alice", email: "alice@example.com" });
    assert.equal(res, null);
  });

  it("createPendingRegistration formats payload and calls PostgREST endpoint", async () => {
    let calledUrl = null;
    let calledOptions = null;

    const mockFetch = async (url, options) => {
      calledUrl = url;
      calledOptions = options;
      return {
        ok: true,
        status: 201,
        json: async () => [{ id: "test-reg-uuid", payment_status: "pending" }],
      };
    };

    const env = {
      SUPABASE_URL: "https://xyz.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: "secret_service_role_key",
    };

    const registrationData = {
      id: "reg-1234",
      name: "Alice Tanaka",
      email: "alice@example.com",
      company: "Startup Co",
      role: "CEO",
      tickets: { startup: 1 },
      totalAmount: 2500,
      questionnaire: { funding_stage: "Seed" },
    };

    const result = await createPendingRegistration(env, registrationData, mockFetch);

    assert.equal(calledUrl, "https://xyz.supabase.co/rest/v1/registrations");
    assert.equal(calledOptions.method, "POST");
    assert.equal(calledOptions.headers.apikey, "secret_service_role_key");
    assert.equal(calledOptions.headers.Authorization, "Bearer secret_service_role_key");

    const sentBody = JSON.parse(calledOptions.body);
    assert.equal(sentBody.id, "reg-1234");
    assert.equal(sentBody.full_name, "Alice Tanaka");
    assert.equal(sentBody.email, "alice@example.com");
    assert.equal(sentBody.payment_status, "pending");
    assert.equal(sentBody.total_amount, 2500);
    assert.deepEqual(sentBody.questionnaire, { funding_stage: "Seed" });

    assert.deepEqual(result, { id: "test-reg-uuid", payment_status: "pending" });
  });

  it("recordPaidRegistration updates existing registration by ID if registration_id is in metadata", async () => {
    let calledUrl = null;
    let calledOptions = null;

    const mockFetch = async (url, options) => {
      calledUrl = url;
      calledOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: "reg-1234", payment_status: "paid", stripe_session_id: "cs_live_999" }],
      };
    };

    const env = {
      SUPABASE_URL: "https://xyz.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "secret_service_role_key",
    };

    const mockSession = {
      id: "cs_live_999",
      payment_intent: "pi_999",
      customer: "cus_999",
      amount_total: 5000,
      currency: "jpy",
      metadata: {
        registration_id: "reg-1234",
        name: "Bob Investor",
        email: "bob@fund.com",
      },
    };

    const lineItems = [
      { description: "Investor ticket", quantity: 1, amount_total: 5000 },
    ];

    const result = await recordPaidRegistration(env, mockSession, lineItems, mockFetch);

    assert.equal(calledUrl, "https://xyz.supabase.co/rest/v1/registrations?id=eq.reg-1234");
    assert.equal(calledOptions.method, "PATCH");

    const sentBody = JSON.parse(calledOptions.body);
    assert.equal(sentBody.stripe_session_id, "cs_live_999");
    assert.equal(sentBody.payment_status, "paid");
    assert.equal(sentBody.metadata.stripe_payment_intent, "pi_999");
    assert.equal(sentBody.metadata.amount_total, 5000);

    assert.equal(result.payment_status, "paid");
  });

  it("recordPaidRegistration upserts by stripe_session_id if no registration_id was found", async () => {
    let calledUrl = null;
    let calledOptions = null;

    const mockFetch = async (url, options) => {
      calledUrl = url;
      calledOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({ stripe_session_id: "cs_direct_111", payment_status: "paid" }),
      };
    };

    const env = {
      SUPABASE_URL: "https://xyz.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "secret_service_role_key",
    };

    const mockSession = {
      id: "cs_direct_111",
      customer_details: { email: "direct@example.com", name: "Direct Buyer" },
      amount_total: 2500,
      currency: "jpy",
    };

    const result = await recordPaidRegistration(env, mockSession, [], mockFetch);

    assert.equal(calledUrl, "https://xyz.supabase.co/rest/v1/registrations?on_conflict=stripe_session_id");
    assert.equal(calledOptions.method, "POST");

    const sentBody = JSON.parse(calledOptions.body);
    assert.equal(sentBody.stripe_session_id, "cs_direct_111");
    assert.equal(sentBody.email, "direct@example.com");
    assert.equal(sentBody.payment_status, "paid");
    assert.equal(result.payment_status, "paid");
  });
});
