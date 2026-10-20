CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  invite TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'English',
  discordGuildId TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_servers_createdAt ON servers(createdAt);
