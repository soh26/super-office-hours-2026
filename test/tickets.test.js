import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createCrewMember,
  createCrewRegistration,
  getRegistrationTicketCounts,
  hasTicketType,
  listCrew,
  listRegistrations,
  normalizeCrewRecord,
} from "../functions/lib/supabase.js";
import {
  onRequestGet as adminTicketsGet,
  onRequestOptions as adminTicketsOptions,
  onRequestPost as adminTicketsPost,
} from "../functions/api/admin/tickets.js";

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
      const urlsCalled = [];
      let calledOptions = null;

      const mockFetch = async (url, options) => {
        urlsCalled.push(url);
        calledOptions = options;
        if (url.includes("/rest/v1/crew")) {
          return {
            ok: true,
            status: 200,
            json: async () => [],
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => mockRegistrations,
        };
      };

      const res = await listRegistrations(env, { status: "all" }, mockFetch);

      assert.ok(urlsCalled.some((u) => u.includes("registrations?order=created_at.desc")));
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
          if (url.includes("/rest/v1/crew")) {
            return new Response(JSON.stringify([]), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
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
        globalThis.fetch = async (url) => {
          if (url.includes("/rest/v1/crew")) {
            return new Response(JSON.stringify([]), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
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

  describe("Ticket Quantity Counting (getRegistrationTicketCounts & Metrics)", () => {
    it("accurately counts ticket quantities from an object representation", () => {
      const reg = {
        tickets: { startup: 3, investor: 2, student: 0 },
      };
      const counts = getRegistrationTicketCounts(reg);
      assert.equal(counts.startup, 3);
      assert.equal(counts.investor, 2);
      assert.equal(counts.student, 0);
      assert.equal(counts.other, 0);
      assert.equal(counts.total, 5);
    });

    it("accurately counts ticket quantities from a Stripe line items array", () => {
      const reg = {
        tickets: [
          { description: "Startup ticket", quantity: 2 },
          { description: "Investor ticket", quantity: 1 },
          { description: "LP Dinner", quantity: 1 }, // add-on, not main ticket
        ],
      };
      const counts = getRegistrationTicketCounts(reg);
      assert.equal(counts.startup, 2);
      assert.equal(counts.investor, 1);
      assert.equal(counts.student, 0);
      assert.equal(counts.other, 0);
      assert.equal(counts.total, 3);
    });

    it("falls back to startup ticket when tickets is missing but startup questionnaire is answered", () => {
      const reg = {
        tickets: null,
        questionnaire: {
          funding_stage: "Seed",
          business_description: "B2B SaaS",
        },
      };
      const counts = getRegistrationTicketCounts(reg);
      assert.equal(counts.startup, 1);
      assert.equal(counts.investor, 0);
      assert.equal(counts.total, 1);
      assert.equal(hasTicketType(reg, "startup"), true);
      assert.equal(hasTicketType(reg, "investor"), false);
    });

    it("falls back to investor ticket when tickets is missing but investor questionnaire is answered", () => {
      const reg = {
        tickets: {},
        questionnaire: {
          investor_ticket_size: "$100k-$500k",
        },
      };
      const counts = getRegistrationTicketCounts(reg);
      assert.equal(counts.investor, 1);
      assert.equal(counts.startup, 0);
      assert.equal(counts.total, 1);
      assert.equal(hasTicketType(reg, "investor"), true);
      assert.equal(hasTicketType(reg, "startup"), false);
    });

    it("defaults to 1 total ticket when no tickets or questionnaire fields exist", () => {
      const reg = {
        tickets: null,
        questionnaire: null,
      };
      const counts = getRegistrationTicketCounts(reg);
      assert.equal(counts.total, 1);
      assert.equal(counts.other, 1);
    });

    it("calculates overall ticket totals (not database row count) across registrations", () => {
      const registrations = [
        {
          id: "reg-1",
          payment_status: "paid",
          tickets: { startup: 3 },
          total_amount: 9000,
        },
        {
          id: "reg-2",
          payment_status: "paid",
          tickets: { investor: 2, student: 1 },
          total_amount: 13000,
        },
        {
          id: "reg-3",
          payment_status: "pending",
          tickets: { startup: 4 },
          total_amount: 12000,
        },
      ];

      let totalTickets = 0;
      let paidTickets = 0;
      let pendingTickets = 0;
      let startupTickets = 0;
      let investorTickets = 0;
      let studentTickets = 0;

      for (const r of registrations) {
        const counts = getRegistrationTicketCounts(r);
        const status = r.payment_status.toLowerCase();

        totalTickets += counts.total;
        startupTickets += counts.startup;
        investorTickets += counts.investor;
        studentTickets += counts.student;

        if (status === "paid") {
          paidTickets += counts.total;
        } else if (status === "pending") {
          pendingTickets += counts.total;
        }
      }

      // 3 DB rows, but 10 total tickets!
      assert.equal(registrations.length, 3);
      assert.equal(totalTickets, 10);
      assert.equal(paidTickets, 6);
      assert.equal(pendingTickets, 4);
      assert.equal(startupTickets, 7);
      assert.equal(investorTickets, 2);
      assert.equal(studentTickets, 1);
    });

    it("accurately counts crew tickets and detects crew ticket type", () => {
      const reg = {
        role: "Stage Manager",
        tickets: { crew: 2 },
      };
      const counts = getRegistrationTicketCounts(reg);
      assert.equal(counts.crew, 2);
      assert.equal(counts.total, 2);
      assert.equal(hasTicketType(reg, "crew"), true);
      assert.equal(hasTicketType(reg, "startup"), false);
    });

    it("falls back to crew ticket when role contains Crew or staff", () => {
      const reg = {
        role: "Event Crew Lead",
        tickets: null,
      };
      const counts = getRegistrationTicketCounts(reg);
      assert.equal(counts.crew, 1);
      assert.equal(counts.total, 1);
      assert.equal(hasTicketType(reg, "crew"), true);
    });

    it("counts crew passes towards the total number of ticket holders", () => {
      const records = [
        {
          id: "r1",
          payment_status: "paid",
          tickets: { startup: 2 },
        },
        {
          id: "r2",
          payment_status: "pending",
          tickets: { investor: 1 },
        },
        {
          id: "r3",
          payment_status: "paid",
          role: "Crew",
          tickets: { crew: 1 },
          metadata: { type: "crew" },
        },
        {
          id: "r4",
          payment_status: "paid",
          role: "Lead Coordinator",
          tickets: { crew: 1 },
          metadata: { type: "crew" },
        },
      ];

      let totalTickets = 0;
      let ticketHolders = 0;
      let pendingTickets = 0;

      for (const r of records) {
        const counts = getRegistrationTicketCounts(r);
        const status = r.payment_status.toLowerCase();
        const isCrew = hasTicketType(r, "crew") || r.metadata?.type === "crew";

        totalTickets += counts.total;
        if (status === "paid" || isCrew) {
          ticketHolders += counts.total;
        } else if (status === "pending") {
          pendingTickets += counts.total;
        }
      }

      // 2 startup (paid) + 2 crew passes = 4 total ticket holders!
      assert.equal(ticketHolders, 4);
      assert.equal(pendingTickets, 1);
      assert.equal(totalTickets, 5);
    });
  });

  describe("Crew Registration with Metadata Attributes (Adhoc Project Schema)", () => {
    it("createCrewRegistration validates that full name is required", async () => {
      const res = await createCrewRegistration(env, { name: "" });
      assert.equal(res.status, 400);
      assert.match(res.error, /Full name is required/);
    });

    it("createCrewRegistration allows email and phone to be optional", async () => {
      let insertedPayload = null;
      let targetUrl = null;

      const mockFetch = async (url, options) => {
        targetUrl = url;
        insertedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          json: async () => [{ ...insertedPayload, id: "crew-opt" }],
        };
      };

      const res = await createCrewRegistration(
        env,
        {
          name: "Solo Crew",
        },
        mockFetch
      );

      assert.equal(res.success, true);
      assert.equal(targetUrl, "https://xyz.supabase.co/rest/v1/registrations");
      assert.equal(insertedPayload.full_name, "Solo Crew");
      assert.equal(insertedPayload.email, "");
      assert.equal(insertedPayload.metadata.phone, null);
      assert.equal(insertedPayload.metadata.email, null);
      assert.equal(insertedPayload.metadata.role, "Crew");
      assert.equal(insertedPayload.metadata.type, "crew");
    });

    it("createCrewRegistration inserts into /rest/v1/registrations with crew attributes in metadata", async () => {
      let insertedPayload = null;
      let targetUrl = null;

      const mockFetch = async (url, options) => {
        targetUrl = url;
        insertedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          json: async () => [{ ...insertedPayload, id: "crew-123" }],
        };
      };

      const res = await createCrewRegistration(
        env,
        {
          name: "Kenji Sato",
          email: "kenji@takeoff-tokyo.com",
          phone: "+81 90-1111-2222",
          role: "Volunteer Lead",
        },
        mockFetch
      );

      assert.equal(res.success, true);
      assert.equal(targetUrl, "https://xyz.supabase.co/rest/v1/registrations");
      assert.equal(insertedPayload.full_name, "Kenji Sato");
      assert.equal(insertedPayload.role, "Volunteer Lead");
      assert.deepEqual(insertedPayload.tickets, { crew: 1 });
      assert.equal(insertedPayload.payment_status, "paid");
      assert.equal(insertedPayload.total_amount, 0);
      assert.equal(insertedPayload.metadata.type, "crew");
      assert.equal(insertedPayload.metadata.role, "Volunteer Lead");
      assert.equal(insertedPayload.metadata.phone, "+81 90-1111-2222");
      assert.equal(insertedPayload.metadata.email, "kenji@takeoff-tokyo.com");
      assert.equal(res.registration.is_crew, true);
    });

    it("listRegistrations filters specifically by type: 'crew'", async () => {
      const mockRows = [
        ...mockRegistrations,
        {
          id: "reg-crew-1",
          full_name: "Crew Member One",
          email: "crew1@event.com",
          company: "Takeoff Tokyo",
          role: "Stage Lead",
          tickets: { crew: 1 },
          payment_status: "paid",
          metadata: { type: "crew", phone: "+81 90-0000-1111", role: "Stage Lead" },
          created_at: "2026-09-23T15:00:00.000Z",
        },
      ];

      const mockFetch = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => mockRows,
        };
      };

      const results = await listRegistrations(env, { type: "crew" }, mockFetch);
      assert.equal(results.length, 1);
      assert.equal(results[0].id, "reg-crew-1");
      assert.equal(results[0].full_name, "Crew Member One");
      assert.equal(results[0].is_crew, true);
    });

    it("POST /api/admin/tickets rejects unauthenticated requests", async () => {
      const req = new Request("http://localhost:8787/api/admin/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Alex" }),
      });

      const res = await adminTicketsPost({ env, request: req });
      assert.equal(res.status, 401);
    });

    it("POST /api/admin/tickets creates crew member and returns 201", async () => {
      const originalFetch = globalThis.fetch;
      try {
        let postedPayload = null;
        let targetUrl = null;
        globalThis.fetch = async (url, options) => {
          targetUrl = url;
          if (options && options.method === "POST") {
            postedPayload = JSON.parse(options.body);
            return new Response(JSON.stringify([{ ...postedPayload, id: "new-crew-456" }]), {
              status: 201,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify([]), { status: 200 });
        };

        const req = new Request("http://localhost:8787/api/admin/tickets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-admin-secret",
          },
          body: JSON.stringify({
            name: "Yuki Crew",
            email: "yuki@takeoff-tokyo.com",
            phone: "+81 90-3333-4444",
            role: "Stage Lead",
          }),
        });

        const res = await adminTicketsPost({ env, request: req });
        assert.equal(res.status, 201);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(targetUrl, "https://xyz.supabase.co/rest/v1/registrations");
        assert.equal(postedPayload.full_name, "Yuki Crew");
        assert.deepEqual(postedPayload.tickets, { crew: 1 });
        assert.equal(postedPayload.metadata.phone, "+81 90-3333-4444");
        assert.equal(postedPayload.metadata.role, "Stage Lead");
        assert.equal(postedPayload.metadata.type, "crew");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
