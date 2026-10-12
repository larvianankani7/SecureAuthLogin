
import nodemailer from "nodemailer";
import { and, eq } from "drizzle-orm";
import { supabase } from "../../lib/supabase.js";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { emailOutbox } from "../../db/schema.js";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: 587,
  secure: false,
  requireTLS: true,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  tls: { minVersion: "TLSv1.2" },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000
});

export async function sendOtpEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true }
  });
  if (error) throw new Error(`Supabase OTP request failed: ${error.message}`);
}

export function getAccountRevokedEmailContent() {
  return {
    subject: "SecureAuthLogin — Account Access Revoked",
    body: [
      "SECUREAUTHLOGIN SECURITY NOTICE",
      "",
      "Your account access has been revoked by an administrator.",
      "",
      "Reason: Suspicious activity was detected.",
      "",
      "Your active sessions have been invalidated. You can no longer sign in to this account, and this email address cannot be used to register another account.",
      "",
      "If you believe this decision was made in error, contact the project administrator through an independently verified support channel.",
      "",
      "SecureAuthLogin Security Team"
    ].join("\n")
  };
}

export function getAccountDeletedEmailContent() {
  return getAccountRevokedEmailContent();
}

export function getAccountLockedEmailContent() {
  return {
    subject: "SecureAuthLogin account temporarily locked",
    body: [
      "Account Temporarily Locked",
      "Five failed login attempts were detected.",
      "Login attempts are temporarily blocked for 15 minutes.",
      "If you did not attempt these logins, contact the project administrator."
    ].join("\n")
  };
}

export async function processEmailOutbox(outboxId?: string): Promise<void> {
  if (!outboxId) return;

  const claimed = await db.update(emailOutbox)
    .set({ status: "sending" })
    .where(and(eq(emailOutbox.id, outboxId), eq(emailOutbox.status, "pending")))
    .returning();

  const email = claimed[0];
  if (!email) return;

  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: email.toEmail,
      subject: email.subject,
      text: email.body
    });

    await db.update(emailOutbox)
      .set({ status: "sent", attempts: email.attempts + 1 })
      .where(eq(emailOutbox.id, email.id));
  } catch (error) {
    await db.update(emailOutbox)
      .set({ status: "failed", attempts: email.attempts + 1 })
      .where(eq(emailOutbox.id, email.id));

    console.error(JSON.stringify({
      event: "revocation_email_delivery_failed",
      outboxId: email.id,
      error: error instanceof Error ? error.message : "Unknown SMTP error"
    }));

    throw new Error("SMTP delivery failed");
  }
}