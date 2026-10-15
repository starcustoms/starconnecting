require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");

const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const dataFile = path.resolve(process.env.DATA_FILE || path.join(__dirname, "data", "servers.json"));
const allowedTypes = new Set(["Roleplay", "Design", "Advertising", "ERLC Bots"]);
const cooldownMs = 6 * 60 * 60 * 1000;

fs.mkdirSync(path.dirname(dataFile), { recursive: true });
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

function readServers() {
  if (!fs.existsSync(dataFile)) return [];
  const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
}

function writeServers(servers) {
  const temporaryFile = `${dataFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(servers, null, 2));
  fs.renameSync(temporaryFile, dataFile);
}

function publicServer({ discordGuildId, ownerDiscordId, ...server }) {
  return server;
}

function isBotRequest(req) {
  const secret = process.env.BOT_API_KEY || "";
  const authorization = req.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret || !supplied) return false;
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function requireBot(req, res, next) {
  if (!isBotRequest(req)) return res.status(401).json({ error: "Unauthorized bot request." });
  next();
}

app.get("/api/servers", (_req, res) => {
  try {
    res.json({ servers: readServers().map(publicServer) });
  } catch (error) {
    console.error("Could not read directory data:", error);
    res.status(500).json({ error: "Could not load the directory." });
  }
});

app.get("/api/servers/in-guild", requireBot, (req, res) => {
  const guildId = String(req.query.guildId || "");
  if (!/^\d{17,20}$/.test(guildId)) return res.status(400).json({ error: "Invalid Discord server ID." });
  try {
    const servers = readServers()
      .filter((server) => server.discordGuildId === guildId)
      .map(({ id, name }) => ({ id, name }));
    res.json({ servers });
  } catch (error) {
    console.error("Could not read guild listings:", error);
    res.status(500).json({ error: "Could not load listings for this server." });
  }
});

app.post("/api/servers", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const description = String(req.body?.description || "").trim();
  const type = String(req.body?.type || "").trim();
  const language = String(req.body?.language || "English").trim();
  const discordGuildId = String(req.body?.discordGuildId || "").trim();
  const invite = String(req.body?.invite || "").trim();

  if (!name || name.length > 60 || !description || description.length > 180) {
    return res.status(400).json({ error: "Enter a name (up to 60 characters) and description (up to 180 characters)." });
  }
  if (!allowedTypes.has(type) || !language || language.length > 30) {
    return res.status(400).json({ error: "Choose a valid category and language." });
  }
  if (!/^\d{17,20}$/.test(discordGuildId)) {
    return res.status(400).json({ error: "Enter a valid 17–20 digit Discord server ID." });
  }
  if (invite) {
    let inviteUrl;
    try { inviteUrl = new URL(invite); } catch { return res.status(400).json({ error: "Enter a valid Discord invite URL." }); }
    if (inviteUrl.protocol !== "https:" || !["discord.gg", "discord.com"].includes(inviteUrl.hostname) || (inviteUrl.hostname === "discord.com" && !inviteUrl.pathname.startsWith("/invite/"))) {
      return res.status(400).json({ error: "Enter a valid Discord invite URL." });
    }
  }

  const listing = {
    id: crypto.randomUUID(), name, description, type, language, members: 0,
    invite, discordGuildId, lastBump: null, tags: [type], verified: false,
  };
  try {
    const servers = readServers();
    servers.push(listing);
    writeServers(servers);
    res.status(201).json({ servers: servers.map(publicServer), listing: publicServer(listing) });
  } catch (error) {
    console.error("Could not save listing:", error);
    res.status(500).json({ error: "Could not save your listing." });
  }
});

app.post("/api/bump", requireBot, (req, res) => {
  const listingId = String(req.body?.listingId || "");
  const discordGuildId = String(req.body?.discordGuildId || "");
  if (!/^\d{17,20}$/.test(discordGuildId)) return res.status(400).json({ error: "Invalid Discord server ID." });

  try {
    const servers = readServers();
    const listing = servers.find((server) => server.id === listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    if (listing.discordGuildId !== discordGuildId) {
      return res.status(403).json({ error: "This command can only bump the listing from its linked Discord server." });
    }

    const now = Date.now();
    const previousBump = listing.lastBump ? Date.parse(listing.lastBump) : 0;
    const remaining = cooldownMs - (now - previousBump);
    if (remaining > 0) {
      return res.status(429).json({ error: "This listing is still on cooldown.", retryAfter: Math.ceil(remaining / 1000) });
    }

    listing.lastBump = new Date(now).toISOString();
    writeServers(servers);
    res.json({ listing: publicServer(listing) });
  } catch (error) {
    console.error("Could not bump listing:", error);
    res.status(500).json({ error: "Could not bump the listing." });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(port, host, () => {
  console.log(`StarConnecting listening on http://${host}:${port}`);
});