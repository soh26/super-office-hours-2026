import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listRegistrations } from "../functions/lib/supabase.js";
import { onRequestGet as adminTicketsGet, onRequestOptions as adminTicketsOptions } from "../functions/api/admin/tickets.js";

describe("Ticket Registrations Admin & Supabase Integration", () => {
  const env = {
    SUPABASE_URL: "https://xyz.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "secret_service_role_key",
    SPONSOR_ADMIN_PASSWORD: "test-admin-secret",
  };

  const mockRegistrations = [
    {
      id: "reg-1",
      full_name: "Alice Founder",
      email: "alice@startup.io",
      company: "Startup AI",
      role: "CEO",
      tickets: { startup: 2 },
      total_amount: 6000,
      currency: "jpy",
      payment_status: "paid",
      created_at: "2026-09-23T10:00:00.000Z",
    },
    {
      id: "reg-2",
      full_name: "Bob Investor",
      email: "bob@vc.com",
      company: "Tokyo Ventures",
      role: "General Partner",
      tickets: { investor: 1 },
      total_amount: 6000,
      currency: "jpy",
      payment_status: "pending",
      created_at: "2026-09-23T11:00:00.000Z",
    },
    {
      id: "reg-3",
      full_name: "Charlie Student",
      email: "charlie@university.ac.jp",
      company: "Tokyo Univ",
      role: "Student",
      tickets: [{ description: "Student ticket", quantity: 1 }],
      total_amount: 1000,
      currency: "jpy",
      payment_status: "paid",
      created_at: "2026-09-23T12:00:00.000Z",
    },
  ];

  describe("Supabase listRegistrations() Helper", () => {
    it("returns empty array if Supabase environment variables are missing", async () => {
      const res = await listRegistrations({}, {});
      assert.deepEqual(res, []);
    });

    it("queries all registrations ordered by created_at descending", async () => {
      let calledUrl = null;
      let calledOptions = null;

      const mockFetch = async (url, options) => {
        calledUrl = url;
        calledOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => mockRegistrations,
        };
      };

      const res = await listRegistrations(env, { status: "all" }, mockFetch);

      assert.equal(calledUrl, "https://xyz.supabase.co/rest/v1/registrations?order=created_at.desc");
      assert.equal(calledOptions.method, "GET");
      assert.equal(calledOptions.headers.apikey, "secret_service_role_key");
      assert.equal(calledOptions.headers.Authorization, "Bearer secret_service_role_key");
      assert.equal(res.length, 3);
      assert.equal(res[0].id, "reg-1");
    });

    it("appends payment_status filter when status is specified (paid)", async () => {
      let calledUrl = null;

      const mockFetch = async (url) => {
        calledUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => mockRegistrations.filter((r) => r.payment_status === "paid"),
        };
      };

      const res = await listRegistrations(env, { status: "paid" }, mockFetch);

      assert.equal(
        calledUrl,
        "https://xyz.supabase.co/rest/v1/registrations?order=created_at.desc&payment_status=eq.paid"
      );
      assert.equal(res.length, 2);
    });

    it("appends payment_status filter when status is specified (pending)", async () => {
      let calledUrl = null;

      const mockFetch = async (url) => {
        calledUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => mockRegistrations.filter((r) => r.payment_status === "pending"),
        };
      };

      const res = await listRegistrations(env, { status: "pending" }, mockFetch);

      assert.equal(
        calledUrl,
        "https://xyz.supabase.co/rest/v1/registrations?order=created_at.desc&payment_status=eq.pending"
      );
      assert.equal(res.length, 1);
      assert.equal(res[0].id, "reg-2");
    });

    it("handles fetch errors gracefully and returns empty array", async () => {
      const mockFetch = async () => {
        throw new Error("Network timeout");
      };

      const res = await listRegistrations(env, {}, mockFetch);
      assert.deepEqual(res, []);
    });
  });

  describe("Admin Tickets API Endpoint (functions/api/admin/tickets.js)", () => {
    it("onRequestOptions returns 204 No Content with CORS headers", async () => {
      const res = await adminTicketsOptions();
      assert.equal(res.status, 204);
      assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
      assert.match(res.headers.get("Access-Control-Allow-Headers"), /Authorization/);
    });

    it("rejects unauthenticated requests without authorization header", async () => {
      const req = new Request("http://localhost:8787/api/admin/tickets", {
        method: "GET",
      });

      const res = await adminTicketsGet({ env, request: req });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.error, /Unauthorized/);
    });

    it("rejects requests with incorrect password", async () => {
      const req = new Request("http://localhost:8787/api/admin/tickets", {
        method: "GET",
        headers: {
          Authorization: "Bearer wrong-password",
        },
      });

      const res = await adminTicketsGet({ env, request: req });
      assert.equal(res.status, 401);
    });

    it("accepts valid Bearer token and returns registrations list", async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (url) => {
          assert.match(url, /registrations\?order=created_at\.desc/);
          return new Response(JSON.stringify(mockRegistrations), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        };

        const req = new Request("http://localhost:8787/api/admin/tickets", {
          method: "GET",
          headers: {
            Authorization: "Bearer test-admin-secret",
          },
        });

        const res = await adminTicketsGet({ env, request: req });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(Array.isArray(data.registrations), true);
        assert.equal(data.registrations.length, 3);
        assert.equal(data.registrations[0].full_name, "Alice Founder");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("accepts valid X-Admin-Password custom header", async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => {
          return new Response(JSON.stringify(mockRegistrations), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        };

        const req = new Request("http://localhost:8787/api/admin/tickets", {
          method: "GET",
          headers: {
            "X-Admin-Password": "test-admin-secret",
          },
        });

        const res = await adminTicketsGet({ env, request: req });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.registrations.length, 3);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("passes ?status=pending query parameter to filter registrations", async () => {
      const originalFetch = globalThis.fetch;
      try {
        let requestedUrl = null;
        globalThis.fetch = async (url) => {
          requestedUrl = url;
          return new Response(JSON.stringify([mockRegistrations[1]]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        };

        const req = new Request("http://localhost:8787/api/admin/tickets?status=pending", {
          method: "GET",
          headers: {
            Authorization: "Bearer test-admin-secret",
          },
        });

        const res = await adminTicketsGet({ env, request: req });
        assert.equal(res.status, 200);
        assert.match(requestedUrl, /payment_status=eq\.pending/);
        const data = await res.json();
        assert.equal(data.registrations.length, 1);
        assert.equal(data.registrations[0].payment_status, "pending");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("passes ?status=paid query parameter to filter registrations", async () => {
      const originalFetch = globalThis.fetch;
      try {
        let requestedUrl = null;
        globalThis.fetch = async (url) => {
          requestedUrl = url;
          return new Response(
            JSON.stringify(mockRegistrations.filter((r) => r.payment_status === "paid")),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        };

        const req = new Request("http://localhost:8787/api/admin/tickets?status=paid", {
          method: "GET",
          headers: {
            Authorization: "Bearer test-admin-secret",
          },
        });

        const res = await adminTicketsGet({ env, request: req });
        assert.equal(res.status, 200);
        assert.match(requestedUrl, /payment_status=eq\.paid/);
        const data = await res.json();
        assert.equal(data.registrations.length, 2);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("filters registrations by ticket type (startup)", async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => {
          return new Response(JSON.stringify(mockRegistrations), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        };

        const req = new Request("http://localhost:8787/api/admin/tickets?type=startup", {
          method: "GET",
          headers: {
            Authorization: "Bearer test-admin-secret",
          },
        });

        const res = await adminTicketsGet({ env, request: req });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.registrations.length, 1);
        assert.equal(data.registrations[0].id, "reg-1");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("filters registrations by ticket type (investor)", async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => {
          return new Response(JSON.stringify(mockRegistrations), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        };

        const req = new Request("http://localhost:8787/api/admin/tickets?type=investor", {
          method: "GET",
          headers: {
            Authorization: "Bearer test-admin-secret",
          },
        });

        const res = await adminTicketsGet({ env, request: req });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.registrations.length, 1);
        assert.equal(data.registrations[0].id, "reg-2");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("filters registrations by ticket type (student)", async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => {
          return new Response(JSON.stringify(mockRegistrations), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        };

        const req = new Request("http://localhost:8787/api/admin/tickets?type=student", {
          method: "GET",
          headers: {
            Authorization: "Bearer test-admin-secret",
          },
        });

        const res = await adminTicketsGet({ env, request: req });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.registrations.length, 1);
        assert.equal(data.registrations[0].id, "reg-3");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("filters registrations by combined status and ticket type (?status=paid&type=startup)", async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => {
          // When querying status=paid, only paid rows are returned from DB
          return new Response(
            JSON.stringify(mockRegistrations.filter((r) => r.payment_status === "paid")),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        };

        const req = new Request("http://localhost:8787/api/admin/tickets?status=paid&type=startup", {
          method: "GET",
          headers: {
            Authorization: "Bearer test-admin-secret",
          },
        });

        const res = await adminTicketsGet({ env, request: req });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.registrations.length, 1);
        assert.equal(data.registrations[0].id, "reg-1");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
