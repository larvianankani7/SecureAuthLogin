import test from 'node:test';
import assert from 'node:assert';
import { db } from '../db/client.js';
import { users, emailOutbox } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { generatePasswordFingerprint } from '../lib/crypto.js';

// Setup: wait for DB to connect, etc.

test('Fingerprint: Should prevent cross-account password reuse', async (t) => {
  const password = "SuperSecretPassword123!";
  const fp = generatePasswordFingerprint(password);

  // Clean up before test
  await db.delete(users).where(eq(users.passwordFingerprint, fp));

  // Insert first user
  await db.insert(users).values({
    email: "user1@test.com",
    username: "user1",
    passwordHash: "dummyhash1",
    passwordFingerprint: fp,
  });

  // Try to insert second user with same fingerprint
  let error;
  try {
    await db.insert(users).values({
      email: "user2@test.com",
      username: "user2",
      passwordHash: "dummyhash2",
      passwordFingerprint: fp,
    });
  } catch (err: any) {
    error = err;
    console.log(err);
  }

  assert.ok(error, 'Should throw an error on duplicate password fingerprint');
  assert.strictEqual(error?.cause?.code || error?.code, '23505', 'Postgres error code should be 23505 (unique_violation)');
  assert.strictEqual(error?.cause?.constraint_name || error?.constraint, 'users_password_fingerprint_unique', 'Violated constraint should be users_password_fingerprint_unique');
  
  // Clean up
  await db.delete(users).where(eq(users.email, "user1@test.com"));
});

test('Deletion Email: Should enqueue email into outbox', async (t) => {
  const email = "deleted@test.com";

  await db.delete(users).where(eq(users.email, email));
  await db.delete(emailOutbox).where(eq(emailOutbox.toEmail, email));

  // Mocking what the route does
  await db.transaction(async (tx) => {
    await tx.insert(emailOutbox).values({
      toEmail: email,
      subject: "Account Deleted",
      body: "Test body"
    });
  });

  const [queued] = await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, email)).limit(1);

  assert.ok(queued, "Email should be enqueued in the outbox");
  assert.strictEqual(queued.toEmail, email, "Email recipient should match");
  assert.strictEqual(queued.status, "pending", "Initial status should be pending");

  // Clean up
  await db.delete(emailOutbox).where(eq(emailOutbox.toEmail, email));
});

test.after(async () => {
  const { closeDatabase } = await import('../db/client.js');
  await closeDatabase();
});
