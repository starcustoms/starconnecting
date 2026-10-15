require("dotenv").config();

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.BOT_GUILD_ID;
const apiKey = process.env.BOT_API_KEY;
const apiBaseUrl = (process.env.API_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

if (!token || !clientId || !apiKey) {
  throw new Error("Set DISCORD_TOKEN, DISCORD_CLIENT_ID, and BOT_API_KEY in .env before starting the bot.");
}

const command = new SlashCommandBuilder()
  .setName("bump")
  .setDescription("Bump this Discord server's ERLC listing on StarConnecting")
  .setDMPermission(false)
  .addStringOption((option) => option
    .setName("listing")
    .setDescription("Choose this Discord server's listing")
    .setRequired(true)
    .setAutocomplete(true));

const rest = new REST({ version: "10" }).setToken(token);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${apiBaseUrl}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(8000),
  });
  const data = await response.json();
  return { response, data };
}

client.once("ready", () => {
  console.log(`StarConnecting bot ready as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    try {
      if (!interaction.guildId) return interaction.respond([]);
      const query = encodeURIComponent(interaction.guildId);
      const { response, data } = await apiRequest(`/api/servers/in-guild?guildId=${query}`);
      if (!response.ok) throw new Error(data.error || "Could not load listings.");
      const search = interaction.options.getFocused().toLowerCase();
      const choices = data.servers
        .filter((server) => server.name.toLowerCase().includes(search))
        .slice(0, 25)
        .map((server) => ({ name: server.name.slice(0, 100), value: server.id }));
      await interaction.respond(choices);
    } catch (error) {
      console.error("Listing autocomplete failed:", error.message);
      await interaction.respond([]).catch(() => {});
    }
    return;
  }

  if (!interaction.isChatInputCommand() || interaction.commandName !== "bump") return;
  if (!interaction.guildId) {
    await interaction.reply({ content: "Use `/bump` inside the Discord server linked to the listing.", ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  try {
    const { response, data } = await apiRequest("/api/bump", {
      method: "POST",
      body: JSON.stringify({
        listingId: interaction.options.getString("listing", true),
        discordGuildId: interaction.guildId,
      }),
    });
    if (response.ok) {
      await interaction.editReply("This server's listing is bumped and back at the top of the directory.");
    } else if (response.status === 429) {
      const totalMinutes = Math.ceil(data.retryAfter / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      await interaction.editReply(`That listing is on cooldown. Try again in ${hours}h ${minutes}m.`);
    } else {
      await interaction.editReply(data.error || "The bump could not be completed.");
    }
  } catch (error) {
    console.error("Bump request failed:", error.message);
    await interaction.editReply("The directory service is unavailable. Try again in a moment.");
  }
});

async function start() {
  const applicationId = clientId;
  const route = guildId
    ? Routes.applicationGuildCommands(applicationId, guildId)
    : Routes.applicationCommands(applicationId);
  await rest.put(route, { body: [command.toJSON()] });
  console.log(guildId ? `Registered /bump in test guild ${guildId}` : "Registered global /bump command");
  await client.login(token);
}

start().catch((error) => {
  console.error("Could not start the bot:", error);
  process.exitCode = 1;
});