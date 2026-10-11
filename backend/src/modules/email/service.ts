import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { emailOutbox } from "../../db/schema.js";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendOtpEmail(
  email: string,
  code: string
): Promise<void> {
  await resend.emails.send({
    from: env.RESEND_FROM,
    to: email,
    subject: "Your SecureAuthLogin verification code",
    text: [
      "Your email verification code is:",
      code,
      `This code expires in ${env.OTP_TTL_SECONDS} seconds.`,
      "Do not share this code with anyone."
    ].join("\n")
  });
}

export function getAccountDeletedEmailContent() {
  return {
    subject: "Account Deleted",
    body: [
      "Account Deleted",
      "Your SecureAuthLogin account has been deleted by an administrator.",
      "Your account access and active sessions have been revoked.",
      "Your email address is blocked from registering another account.",
      "If you believe this action was taken in error, contact the project administrator."
    ].join("\n")
  };
}

export function getAccountLockedEmailContent() {
  return {
    subject: "SecureAuthLogin account temporarily locked",
    body: [
      "Account Temporarily Locked",
      "We detected five failed login attempts for your SecureAuthLogin account.",
      "Login attempts are temporarily blocked for 15 minutes.",
      "If you did not attempt these logins, consider changing your password after access is restored.",
      "If you continue to have trouble signing in, contact the project administrator."
    ].join("\n")
  };
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function processEmailOutbox(): Promise<void> {
  const pending = await db
    .select()
    .from(emailOutbox)
    .where(eq(emailOutbox.status, "pending"))
    .limit(10);

  for (const email of pending) {
    let sent = false;

    // Retry transient failures immediately, with a short delay.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await resend.emails.send({
          from: env.RESEND_FROM,
          to: email.toEmail,
          subject: email.subject,
          text: email.body
        });

        await db
          .update(emailOutbox)
          .set({
            status: "sent",
            attempts: email.attempts + attempt + 1
          })
          .where(eq(emailOutbox.id, email.id));

        sent = true;
        break;
      } catch (error) {
        const attempts = email.attempts + attempt + 1;
        const finalAttempt = attempt === 4;

        await db
          .update(emailOutbox)
          .set({
            attempts,
            status: finalAttempt ? "failed" : "pending"
          })
          .where(eq(emailOutbox.id, email.id));

        if (finalAttempt) {
          console.error(
            `Email delivery failed after ${attempts} attempts for outbox item ${email.id}.`,
            error
          );
        } else {
          await sleep(500 * (attempt + 1));
        }
      }
    }

    if (!sent) {
      // The failed/pending status is retained for future recovery.
      continue;
    }
  }
}