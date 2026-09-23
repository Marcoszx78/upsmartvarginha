import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const profiles = sqliteTable('account_profiles', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  city: text('city').notNull().default(''),
  state: text('state').notNull().default(''),
  avatarKey: text('avatar_key').notNull().default(''),
  version: integer('version').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
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
export const productDetails = sqliteTable('product_details', {productId:text('product_id').primaryKey(),data:text('data').notNull()});
export const storeContent = sqliteTable('store_content', {id:integer('id').primaryKey(),data:text('data').notNull(),version:integer('version').notNull().default(1)});
export const favorites = sqliteTable('account_favorites', {accountKey:text('account_key').notNull(),productId:text('product_id').notNull(),createdAt:integer('created_at').notNull()},t=>[primaryKey({columns:[t.accountKey,t.productId]})]);
export const security = sqliteTable('account_security', {key:text('key').primaryKey(),passwordHash:text('password_hash'),recoveryHash:text('recovery_hash'),baseHash:text('base_hash').notNull()});
