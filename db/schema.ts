import { sql } from "drizzle-orm";
import {
  sqliteTable, text, integer, index, uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);

/* ───────────── Access (no roles: any APPROVED admin has full access) ───────────── */

export const admins = sqliteTable("admins", {
  id: id(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull().unique(), // normalised 2547XXXXXXXX
  passcodeHash: text("passcode_hash").notNull(), // PBKDF2 via WebCrypto (lib/passcode.ts)
  passcodeSalt: text("passcode_salt").notNull(),
  // pending = registered, waiting for an approved admin. Only "approved" can sign in.
  status: text("status", { enum: ["pending", "approved", "suspended"] }).notNull().default("pending"),
  approvedBy: text("approved_by"), // admin id, plain text (no FK: seed admin has none)
  approvedAt: integer("approved_at", { mode: "timestamp" }),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  createdAt: createdAt(),
}, (t) => [index("admins_status_idx").on(t.status)]);

export type Admin = typeof admins.$inferSelect;

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // SHA-256 of the cookie token, never the token itself
  adminId: text("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
}, (t) => [
  index("sessions_admin_idx").on(t.adminId),
  index("sessions_expires_idx").on(t.expiresAt),
]);

export const loginAttempts = sqliteTable("login_attempts", {
  id: id(),
  key: text("key").notNull(), // "ip:1.2.3.4" or "phone:2547..."
  success: integer("success", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)]);

/* ───────────── Property ───────────── */

/**
 * A paybill or till the business receives rent on. Each one has its own Daraja app, so the
 * credentials live here (the secret is AES-GCM encrypted, see lib/mpesa/crypto.ts).
 */
export const shortcodes = sqliteTable("shortcodes", {
  id: id(),
  label: text("label").notNull(), // "Kijani Court paybill"
  type: text("type", { enum: ["paybill", "till"] }).notNull(),
  number: text("number").notNull().unique(), // the paybill / till number tenants pay to
  env: text("env", { enum: ["sandbox", "production"] }).notNull().default("production"),
  consumerKey: text("consumer_key"),
  consumerSecretEnc: text("consumer_secret_enc"), // never returned to the browser
  nominatedNumber: text("nominated_number"), // Safaricom MSISDN used for Pull registration
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  urlsRegisteredAt: integer("urls_registered_at", { mode: "timestamp" }),
  pullRegisteredAt: integer("pull_registered_at", { mode: "timestamp" }),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
  lastSyncError: text("last_sync_error"),
  createdAt: createdAt(),
});

export type ShortcodeRow = typeof shortcodes.$inferSelect;

export const buildings = sqliteTable("buildings", {
  id: id(),
  name: text("name").notNull().unique(),
  totalUnits: integer("total_units").notNull(),
  address: text("address"),
  // Required by the app for every new building and locked once set. Nullable in the database only
  // so buildings created before shortcodes existed keep working until you attach one.
  shortcodeId: text("shortcode_id").references(() => shortcodes.id),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  createdAt: createdAt(),
}, (t) => [index("buildings_shortcode_idx").on(t.shortcodeId)]);

export const tenants = sqliteTable("tenants", {
  id: id(),
  name: text("name").notNull(),
  nationalId: text("national_id").notNull(),
  phone: text("phone").notNull(),
  buildingId: text("building_id").notNull().references(() => buildings.id),
  houseNo: text("house_no"), // optional
  rentAmount: integer("rent_amount").notNull(), // whole KES
  accountRef: text("account_ref"), // paybill account number tenants type. NULL for till buildings. Unique per shortcode (checked in the app)
  moveInDate: text("move_in_date").notNull(), // YYYY-MM-DD
  status: text("status", { enum: ["active", "moved_out"] }).notNull().default("active"),
  paidThrough: text("paid_through"), // "YYYY-MM", denormalised for fast dashboards
  creditBalance: integer("credit_balance").notNull().default(0), // overpayment carried forward
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("tenants_building_idx").on(t.buildingId),
  index("tenants_status_paid_idx").on(t.status, t.paidThrough),
  index("tenants_phone_idx").on(t.phone),
  // a house can only have one ACTIVE tenant; NULL house numbers are allowed freely
  uniqueIndex("tenants_active_house_uq").on(t.buildingId, t.houseNo).where(sql`status = 'active'`),
]);

/* ───────────── M-Pesa ───────────── */

export const payments = sqliteTable("payments", {
  id: id(),
  mpesaReceipt: text("mpesa_receipt").notNull().unique(), // idempotency key
  amount: integer("amount").notNull(),
  billRef: text("bill_ref"), // account number typed by the payer (paybill only)
  shortcodeId: text("shortcode_id").references(() => shortcodes.id), // which paybill/till received it
  shortcodeNumber: text("shortcode_number"), // the raw number from the payload, so payments can be linked later
  msisdnHash: text("msisdn_hash"), // C2B v2 sends it hashed
  payerName: text("payer_name"),
  paidAt: integer("paid_at", { mode: "timestamp" }).notNull(),
  tenantId: text("tenant_id").references(() => tenants.id),
  status: text("status", { enum: ["matched", "unmatched", "ignored"] }).notNull().default("unmatched"),
  source: text("source", { enum: ["c2b", "reconcile", "manual"] }).notNull().default("c2b"),
  raw: text("raw"), // original JSON payload
  createdAt: createdAt(),
}, (t) => [
  index("payments_tenant_idx").on(t.tenantId),
  index("payments_paid_at_idx").on(t.paidAt),
  index("payments_status_idx").on(t.status),
  index("payments_shortcode_idx").on(t.shortcodeId),
]);

// One payment can cover several months; one month can be covered by several payments.
export const paymentAllocations = sqliteTable("payment_allocations", {
  id: id(),
  paymentId: text("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  period: text("period").notNull(), // "YYYY-MM"
  amount: integer("amount").notNull(),
}, (t) => [
  uniqueIndex("alloc_payment_period_uq").on(t.paymentId, t.period),
  index("alloc_tenant_period_idx").on(t.tenantId, t.period),
]);

export const syncRuns = sqliteTable("sync_runs", {
  id: id(),
  trigger: text("trigger", { enum: ["cron", "manual", "page_open"] }).notNull(),
  status: text("status", { enum: ["running", "ok", "failed"] }).notNull().default("running"),
  fetched: integer("fetched").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  error: text("error"),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
}, (t) => [index("sync_runs_started_idx").on(t.startedAt)]);

/* ───────────── Settings & audit ───────────── */

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

/** Used when a key has no row yet. Edited on the Settings page. */
export const SETTING_DEFAULTS = {
  rent_due_day: "5", // day of month rent is due
  grace_days: "3", // days after due day before a tenant counts as overdue
  timezone: "Africa/Nairobi",
  registration_open: "true", // can new admins request access?
  max_pending_admins: "20", // cap on waiting requests
  sync_cooldown_seconds: "60", // min gap between page-open / refresh syncs
  sms_reminders_enabled: "false", // reserved for later
  sms_reminder_days_before: "2", // reserved for later
} as const;

export const auditLog = sqliteTable("audit_log", {
  id: id(),
  adminId: text("admin_id").references(() => admins.id),
  action: text("action").notNull(), // e.g. "tenant.create"
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  meta: text("meta"), // JSON
  createdAt: createdAt(),
}, (t) => [index("audit_created_idx").on(t.createdAt)]);

/* ───────────── Reserved for SMS (unused for now, so no migration needed later) ───────────── */

export const notifications = sqliteTable("notifications", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  period: text("period").notNull(), // "YYYY-MM"
  kind: text("kind", { enum: ["reminder", "overdue", "receipt"] }).notNull(),
  channel: text("channel", { enum: ["sms"] }).notNull().default("sms"),
  status: text("status", { enum: ["queued", "sent", "failed"] }).notNull().default("queued"),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("notif_once_uq").on(t.tenantId, t.period, t.kind)]);
