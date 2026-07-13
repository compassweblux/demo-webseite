/* =============================================================
   La Table du Kirchberg — Plat-du-jour API (Cloudflare Worker)

   GET  /api/plat-du-jour  → { dish, price, description, updatedAt }
   POST /api/plat-du-jour  → speichert; Auth: "Authorization: Bearer <PIN>"

   Bindings (siehe wrangler.toml / README.md):
   - KV-Namespace:  PLAT_DU_JOUR
   - Secret:        ADMIN_PIN   (niemals im Code hinterlegen!)
   ============================================================= */

const KV_KEY = "current";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/plat-du-jour") {
      return json({ error: "Not found" }, 404);
    }

    // CORS-Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    /* ---------------- GET: aktuelles Gericht ---------------- */
    if (request.method === "GET") {
      const stored = await env.PLAT_DU_JOUR.get(KV_KEY);
      if (!stored) {
        return json({ error: "No plat du jour set" }, 404, {
          "Cache-Control": "public, max-age=60",
        });
      }
      return new Response(stored, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=60",
          ...CORS_HEADERS,
        },
      });
    }

    /* ---------------- POST: Gericht speichern ---------------- */
    if (request.method === "POST") {
      // Auth: Bearer-PIN gegen das Worker-Secret ADMIN_PIN
      const auth = request.headers.get("Authorization") || "";
      const pin = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

      if (!env.ADMIN_PIN) {
        return json({ error: "Server misconfigured: ADMIN_PIN secret missing" }, 500);
      }
      if (!pin || pin !== env.ADMIN_PIN) {
        return json({ error: "Invalid PIN" }, 401);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const dish = String(body.dish || "").trim();
      const price = String(body.price || "").trim();
      const description = String(body.description || "").trim();

      if (!dish) return json({ error: "Field 'dish' is required" }, 400);
      if (dish.length > 120 || price.length > 30 || description.length > 500) {
        return json({ error: "Field too long" }, 400);
      }

      const record = {
        dish,
        price,
        description,
        updatedAt: new Date().toISOString(),
      };

      await env.PLAT_DU_JOUR.put(KV_KEY, JSON.stringify(record));
      return json(record, 200);
    }

    return json({ error: "Method not allowed" }, 405);
  },
};
