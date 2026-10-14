
import { and, eq } from "drizzle-orm";
import { supabase } from "../../lib/supabase.js";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { emailOutbox } from "../../db/schema.js";

export async function sendOtpEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true }
  });

  if (error) {
    throw new Error(`Supabase OTP request failed: ${error.message}`);
  }
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

  const claimed = await db
    .update(emailOutbox)
    .set({ status: "sending" })
    .where(
      and(
        eq(emailOutbox.id, outboxId),
        eq(emailOutbox.status, "pending")
      )
    )
    .returning();

  const email = claimed[0];
  if (!email) return;

  try {
    const response = await fetch(
      `${env.EMAIL_RELAY_URL}/internal/send-revocation`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.EMAIL_RELAY_API_KEY.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          toEmail: email.toEmail,
          outboxId: email.id,
          subject: email.subject,
          text: email.body
        }),
        signal: AbortSignal.timeout(25_000)
      }
    );

    if (!response.ok) {
      throw new Error(`Email relay returned HTTP ${response.status}`);
    }

    const result = await response.json() as {
      accepted: boolean;
      outboxId: string;
    };

    if (!result.accepted || result.outboxId !== email.id) {
      throw new Error("Email relay did not confirm the expected message");
    }

    await db
      .update(emailOutbox)
      .set({
        status: "sent",
        attempts: email.attempts + 1
      })
      .where(eq(emailOutbox.id, email.id));

    console.info(JSON.stringify({
      event: "revocation_email_accepted_by_relay",
      outboxId: email.id
    }));
  } catch (error) {
    await db
      .update(emailOutbox)
      .set({
        status: "failed",
        attempts: email.attempts + 1
      })
      .where(eq(emailOutbox.id, email.id));

    console.error(JSON.stringify({
      event: "revocation_email_delivery_failed",
      outboxId: email.id,
      error: error instanceof Error
        ? error.message
        : "Unknown email relay error"
    }));

    throw new Error("Email relay delivery failed");
  }
}