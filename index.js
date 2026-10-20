const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400"
};

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}

function validInvite(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (!["discord.gg", "www.discord.gg", "discord.com", "www.discord.com"].includes(url.hostname)) return false;
    if (url.hostname.includes("discord.com") && !url.pathname.startsWith("/invite/")) return false;
    return Boolean(url.pathname.replaceAll("/", ""));
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return respond({
        name: "StarConnecting API",
        status: "online",
        routes: ["GET /api/servers", "POST /api/servers"]
      });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return respond({ status: "ok", databaseConfigured: Boolean(env.DB) });
    }

    if (url.pathname !== "/api/servers") {
      return respond({ error: "Route not found", path: url.pathname }, 404);
    }

    if (!env.DB) {
      return respond({ error: "Database binding DB is missing. Configure the D1 binding named DB in Cloudflare." }, 500);
    }

    try {
      if (request.method === "GET") {
        const { results } = await env.DB.prepare(`
          SELECT id, name, type, description, invite, language, discordGuildId, createdAt
          FROM servers
          ORDER BY createdAt DESC
          LIMIT 500
        `).all();
        return respond({ servers: results || [] });
      }

      if (request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return respond({ error: "Request body must be valid JSON." }, 400);
        }

        const name = String(body.name || "").trim();
        const type = String(body.type || "").trim().toLowerCase();
        const description = String(body.description || "").trim();
        const invite = String(body.invite || "").trim();
        const language = String(body.language || "English").trim().slice(0, 40);
        const discordGuildId = String(body.discordGuildId || "").trim();

        const allowedTypes = new Set(["roleplay", "realism", "community", "training", "other"]);
        if (name.length < 2 || name.length > 70) return respond({ error: "Server name must be 2–70 characters." }, 400);
        if (!allowedTypes.has(type)) return respond({ error: "Choose a valid server type." }, 400);
        if (description.length < 20 || description.length > 500) return respond({ error: "Description must be 20–500 characters." }, 400);
        if (!validInvite(invite)) return respond({ error: "Enter a valid HTTPS Discord invite URL." }, 400);
        if (discordGuildId && !/^\d{15,25}$/.test(discordGuildId)) return respond({ error: "Discord server ID must contain 15–25 digits." }, 400);

        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();

        await env.DB.prepare(`
          INSERT INTO servers (id, name, type, description, invite, language, discordGuildId, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, name, type, description, invite, language, discordGuildId, createdAt).run();

        return respond({
          success: true,
          server: { id, name, type, description, invite, language, discordGuildId, createdAt }
        }, 201);
      }

      return respond({ error: "Method not allowed" }, 405);
    } catch (error) {
      console.error("StarConnecting API error:", error);
      return respond({ error: "Database request failed. Check that the D1 database has the servers table." }, 500);
    }
  }
};
