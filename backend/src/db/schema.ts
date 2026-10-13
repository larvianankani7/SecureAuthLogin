import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  integer
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: varchar("public_id", { length: 43 }).notNull().unique(),
    email: varchar("email", { length: 254 }).notNull().unique(),
    username: varchar("username", { length: 32 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordFingerprint: varchar("password_fingerprint", { length: 64 }).unique().notNull(),
    role: userRole("role").notNull().default("user"),
    emailVerifiedAt: timestamp("email_verified_at", {
      withTimezone: true
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("users_created_at_idx").on(table.createdAt),
    index("users_public_id_idx").on(table.publicId)
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt)
  ]
);

export const blockedEmails = pgTable("blocked_emails", {
  email: varchar("email", { length: 254 }).primaryKey(),
  reason: varchar("reason", { length: 64 }).notNull(),
  blockedAt: timestamp("blocked_at", { withTimezone: true }).defaultNow()
});

export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  toEmail: varchar("to_email", { length: 254 }).notNull(),
  subject: varchar("subject", { length: 254 }).notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", {
    withTimezone: true
  }).notNull().defaultNow()
});