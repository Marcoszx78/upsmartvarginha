import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const sessions = sqliteTable('account_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  accountId: text('account_id').notNull(),
  role: text('role').notNull(),
  credentialVersion: text('credential_version'),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('idx_account_sessions_expires').on(table.expiresAt)]);
export const attempts = sqliteTable('auth_attempts', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('idx_auth_attempts_expires').on(table.expiresAt)]);
