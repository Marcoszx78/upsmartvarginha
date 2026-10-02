// Schema isolated from other Supabase applications. Additive initialization only.
export const schemaStatements=[
  "CREATE TABLE IF NOT EXISTS products (\n id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',\n price INTEGER, stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), low_stock INTEGER NOT NULL DEFAULT 2 CHECK(low_stock>=0),\n image TEXT NOT NULL DEFAULT '', condition TEXT NOT NULL DEFAULT 'Novo', featured INTEGER NOT NULL DEFAULT 0,\n published INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,\n created_at TEXT NOT NULL, updated_at TEXT NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), theme TEXT NOT NULL DEFAULT 'light', accent TEXT NOT NULL DEFAULT 'orange', version INTEGER NOT NULL DEFAULT 1)",
  "INSERT INTO settings(id,theme,accent) VALUES(1,'light','orange') ON CONFLICT DO NOTHING",
  "CREATE TABLE IF NOT EXISTS \"accounts\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"username\" text NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"password_hash\" text NOT NULL,\n\t\"created_at\" BIGINT NOT NULL\n)",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"accounts_username_unique\" ON \"accounts\" (\"username\")",
  "CREATE TABLE IF NOT EXISTS \"auth_attempts\" (\n\t\"key\" text PRIMARY KEY NOT NULL,\n\t\"count\" integer NOT NULL,\n\t\"expires_at\" BIGINT NOT NULL\n)",
  "CREATE INDEX IF NOT EXISTS \"idx_auth_attempts_expires\" ON \"auth_attempts\" (\"expires_at\")",
  "CREATE TABLE IF NOT EXISTS \"account_sessions\" (\n\t\"token_hash\" text PRIMARY KEY NOT NULL,\n\t\"account_id\" text NOT NULL,\n\t\"role\" text NOT NULL,\n\t\"credential_version\" text,\n\t\"expires_at\" BIGINT NOT NULL\n)",
  "CREATE INDEX IF NOT EXISTS \"idx_account_sessions_expires\" ON \"account_sessions\" (\"expires_at\")",
  "CREATE TABLE IF NOT EXISTS \"account_profiles\" (\n\t\"key\" text PRIMARY KEY NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"email\" text DEFAULT '' NOT NULL,\n\t\"phone\" text DEFAULT '' NOT NULL,\n\t\"city\" text DEFAULT '' NOT NULL,\n\t\"state\" text DEFAULT '' NOT NULL,\n\t\"avatar_key\" text DEFAULT '' NOT NULL,\n\t\"version\" integer DEFAULT 1 NOT NULL,\n\t\"updated_at\" BIGINT NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS \"account_favorites\" (\n\t\"account_key\" text NOT NULL,\n\t\"product_id\" text NOT NULL,\n\t\"created_at\" BIGINT NOT NULL,\n\tPRIMARY KEY(\"account_key\", \"product_id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"product_details\" (\n\t\"product_id\" text PRIMARY KEY NOT NULL,\n\t\"data\" text NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS \"account_security\" (\n\t\"key\" text PRIMARY KEY NOT NULL,\n\t\"password_hash\" text,\n\t\"recovery_hash\" text,\n\t\"base_hash\" text NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS \"store_content\" (\n\t\"id\" integer PRIMARY KEY NOT NULL,\n\t\"data\" text NOT NULL,\n\t\"version\" integer DEFAULT 1 NOT NULL\n)"
];
