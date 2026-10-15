# StarConnecting

A grayscale ERLC directory with persistent listings and a Discord `/bump` bot. Categories are Roleplay, Design, Advertising, and ERLC Bots. Anyone in a listing's linked Discord server can bump it.

## Requirements

- Node.js 18 or newer
- A Discord application and bot from the Discord Developer Portal

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Fill in `.env`. Start the web service and bot in separate PowerShell terminals:

```powershell
npm start
```

```powershell
npm run bot
```

Open `http://127.0.0.1:3000`.

## Discord bot configuration

Create an application in the Discord Developer Portal. Set `DISCORD_TOKEN` to the bot token and `DISCORD_CLIENT_ID` to the application ID. Invite the bot with the `bot` and `applications.commands` scopes; no privileged intents are required. Use `BOT_GUILD_ID` while testing for fast command registration, or leave it blank to register `/bump` globally. Global registration can take a while to appear.

Set a long random `BOT_API_KEY` value. The API and bot must share the same key. `API_BASE_URL` must point the bot at the web service. Start the web service before the bot.

List a community from the site and enter the 17–20 digit ID of the Discord server where members will use `/bump`. In Discord, enable Developer Mode and copy the server ID from its context menu. Invite the bot to that server. Members can type `/bump` there and choose the linked listing from autocomplete. The API only accepts a bump when the command's Discord server matches the listing's linked server; each listing can be bumped once every six hours. The linked server ID is kept private and excluded from public listing data.

## Environment variables

- `DISCORD_TOKEN`: Discord bot token.
- `DISCORD_CLIENT_ID`: Discord application ID used to register slash commands.
- `BOT_GUILD_ID`: Optional test server ID for faster command registration.
- `BOT_API_KEY`: Shared secret for bot-to-site API requests.
- `API_BASE_URL`: Site API address used by the bot.
- `HOST`: Web server bind address, default `127.0.0.1`.
- `PORT`: Web server port, default `3000`.
- `DATA_FILE`: Optional listing JSON path, default `data/servers.json`.

Keep `.env` and the Discord bot token private. The sample directory entries are illustrative and have no join invites configured.