import argon2 from "argon2";
import { and, eq, ne } from "drizzle-orm";
import { db } from "./client.js";
import { users } from "./schema.js";
import { env } from "../config/env.js";
import { generatePasswordFingerprint } from "../lib/crypto.js";

export async function ensureAdminAccount(): Promise<void> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, env.ADMIN_EMAIL)
  });

  await db
    .update(users)
    .set({ role: "user" })
    .where(and(eq(users.role, "admin"), ne(users.email, env.ADMIN_EMAIL)));

  if (!existing) {
    await db.insert(users).values({
      email: env.ADMIN_EMAIL,
      username: env.ADMIN_EMAIL.split("@")[0].slice(0, 32),
      passwordHash: await argon2.hash(env.ADMIN_PASSWORD, {
        type: argon2.argon2id
      }),
      passwordFingerprint: generatePasswordFingerprint(env.ADMIN_PASSWORD),
      role: "admin",
      emailVerifiedAt: new Date()
    });
    return;
  }

  if (existing.role !== "admin") {
    await db
      .update(users)
      .set({
        passwordHash: await argon2.hash(env.ADMIN_PASSWORD, {
          type: argon2.argon2id
        }),
        passwordFingerprint: generatePasswordFingerprint(env.ADMIN_PASSWORD),
        role: "admin",
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date()
      })
      .where(eq(users.id, existing.id));
  }
}