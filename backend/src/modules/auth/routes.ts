
import type { FastifyInstance, FastifyReply } from "fastify";

import argon2 from "argon2";

import { and, eq, isNull } from "drizzle-orm";

import { randomUUID } from "node:crypto";

import { db } from "../../db/client.js";
import { redis } from "../../db/redis.js";

import {
  blockedEmails,
  emailOutbox,
  sessions,
  users
} from "../../db/schema.js";

import { env } from "../../config/env.js";

import {
  durationToMs,
  emailRateLimitKey,
  generateOtp,
  generatePasswordFingerprint,
  generateRefreshToken,
  hashOtp,
  hashRefreshToken,
  normalizeEmail,
  safeHashCompare
} from "../../lib/crypto.js";

import { checkRateLimit } from "../../lib/rate-limit.js";

import {
  sendOtpEmail,
  getAccountLockedEmailContent,
  processEmailOutbox
} from "../email/service.js";

type SignupBody = {
  email?: string;
  password?: string;
  username?: string;
};

type PendingSignup = {
  username: string;
  passwordHash: string;
  passwordFingerprint: string;
};

type VerifyBody = {
  email?: string;
  code?: string;
};

type LoginBody = {
  email?: string;
  password?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const accessCookie = "access_token";
const refreshCookie = "refresh_token";

function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? ("none" as const) : ("lax" as const)
  };
}

function setSessionCookies(
  app: FastifyInstance,
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string
): void {
  reply.setCookie(accessCookie, accessToken, {
    ...cookieOptions(env.COOKIE_SECURE),
    path: "/",
    maxAge: Math.floor(durationToMs(env.ACCESS_TOKEN_TTL) / 1000)
  });

  reply.setCookie(refreshCookie, refreshToken, {
    ...cookieOptions(env.COOKIE_SECURE),
    path: "/api/auth",
    maxAge: Math.floor(durationToMs(env.REFRESH_TOKEN_TTL) / 1000)
  });
}

function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(accessCookie, {
    ...cookieOptions(env.COOKIE_SECURE),
    path: "/"
  });

  reply.clearCookie(refreshCookie, {
    ...cookieOptions(env.COOKIE_SECURE),
    path: "/api/auth"
  });
}

async function issueSession(
  app: FastifyInstance,
  reply: FastifyReply,
  user: { id: string; role: "user" | "admin" }
): Promise<void> {
  const refreshToken = generateRefreshToken();
  const sessionId = randomUUID();

  const expiresAt = new Date(
    Date.now() + durationToMs(env.REFRESH_TOKEN_TTL)
  );

  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt
  });

  const accessToken = app.jwt.sign(
    { sub: user.id, sid: sessionId, role: user.role },
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );

  setSessionCookies(app, reply, accessToken, refreshToken);
}

async function storeAndSendOtp(email: string): Promise<void> {
  const code = generateOtp();

  await redis.set(
    `otp:signup:${email}`,
    hashOtp(email, code),
    { EX: env.OTP_TTL_SECONDS }
  );

  await redis.set(
    `otp:attempts:${email}`,
    "0",
    { EX: env.OTP_TTL_SECONDS }
  );

  await sendOtpEmail(email, code);
}

async function clearPendingSignup(email: string): Promise<void> {
  await redis.del(`signup:pending:${email}`);
  await redis.del(`otp:signup:${email}`);
  await redis.del(`otp:attempts:${email}`);
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const dbError = error as {
    code?: string;
    cause?: { code?: string };
  };

  return (dbError.code ?? dbError.cause?.code) === "23505";
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // SIGNUP
  // Keep the new account in Redis until the email OTP is verified.
  app.post<{ Body: SignupBody }>("/signup", async (request, reply) => {
    const ipAllowed = await checkRateLimit(
      `limit:signup:ip:${request.ip}`,
      5,
      900
    );

    if (!ipAllowed) {
      return reply.code(429).send({
        message: "Too many requests. Try again later."
      });
    }

    const email = normalizeEmail(request.body?.email ?? "");
    const password = request.body?.password ?? "";
    const username =
      request.body?.username?.trim() || email.split("@")[0];

    if (
      !emailPattern.test(email) ||
      email.length > 254 ||
      password.length < 8 ||
      password.length > 128 ||
      username.length < 2 ||
      username.length > 32
    ) {
      return reply.code(400).send({
        message:
          "Enter a valid email, a password of 8–128 characters, and a username of 2–32 characters."
      });
    }

    if (email === env.ADMIN_EMAIL) {
      return reply.code(409).send({
        message: "This email cannot be registered."
      });
    }

    const emailAllowed = await checkRateLimit(
      `limit:signup:email:${emailRateLimitKey(email)}`,
      3,
      3600
    );

    if (!emailAllowed) {
      return reply.code(429).send({
        message: "Too many signup attempts."
      });
    }

    const [blocked] = await db
      .select({ email: blockedEmails.email })
      .from(blockedEmails)
      .where(eq(blockedEmails.email, email))
      .limit(1);

    if (blocked) {
      return reply.code(403).send({
        message: "This email cannot be registered."
      });
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return reply.code(409).send({
        message: "An account already exists for this email."
      });
    }

    const passwordFingerprint = generatePasswordFingerprint(password);

    const [fingerprintMatch] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.passwordFingerprint, passwordFingerprint))
      .limit(1);

    if (fingerprintMatch) {
      return reply.code(409).send({
        message:
          "This password has already been used. Please choose a different password."
      });
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id
    });

    const pendingSignup: PendingSignup = {
      username,
      passwordHash,
      passwordFingerprint
    };

    // No PostgreSQL account is created at this stage.
    try {
      await redis.set(
        `signup:pending:${email}`,
        JSON.stringify(pendingSignup),
        { EX: env.OTP_TTL_SECONDS }
      );

      await storeAndSendOtp(email);
    } catch (error) {
      request.log.error(
        { err: error },
        "Signup OTP delivery or pending signup storage failed"
      );

      try {
        await clearPendingSignup(email);
      } catch (cleanupError) {
        request.log.error(
          { err: cleanupError },
          "Failed to clean up pending signup"
        );
      }

      return reply.code(503).send({
        message:
          "The verification email could not be sent. No account was created. Please try again."
      });
    }

    return reply.code(201).send({
      message:
        "Verification code sent. Verify your email to create your account."
    });
  });

  // VERIFY OTP
  // Create the PostgreSQL account only after the OTP is correct.
  app.post<{ Body: VerifyBody }>(
    "/verify-otp",
    async (request, reply) => {
      const ipAllowed = await checkRateLimit(
        `limit:otp:ip:${request.ip}`,
        20,
        900
      );

      if (!ipAllowed) {
        return reply.code(429).send({
          message: "Too many verification attempts."
        });
      }

      const email = normalizeEmail(request.body?.email ?? "");
      const code = request.body?.code ?? "";

      if (!emailPattern.test(email) || !/^\d{6}$/.test(code)) {
        return reply.code(400).send({
          message: "Invalid verification request."
        });
      }

      const attemptsKey = `otp:attempts:${email}`;
      const otpKey = `otp:signup:${email}`;
      const pendingKey = `signup:pending:${email}`;

      const attempts = Number((await redis.get(attemptsKey)) ?? "0");

      if (attempts >= env.OTP_MAX_ATTEMPTS) {
        return reply.code(429).send({
          message: "Too many incorrect codes. Request a new code."
        });
      }

      const storedHash = await redis.get(otpKey);

      if (!storedHash) {
        return reply.code(400).send({
          message: "The code is invalid or expired."
        });
      }

      const suppliedHash = hashOtp(email, code);

      if (!safeHashCompare(storedHash, suppliedHash)) {
        const count = await redis.incr(attemptsKey);

        if (count === 1) {
          await redis.expire(attemptsKey, env.OTP_TTL_SECONDS);
        }

        return reply.code(400).send({
          message: "The code is invalid or expired."
        });
      }

      const pendingJson = await redis.get(pendingKey);

      if (!pendingJson) {
        await clearPendingSignup(email);

        return reply.code(400).send({
          message:
            "Your pending signup has expired. Please sign up again."
        });
      }

      let pendingSignup: PendingSignup;

      try {
        pendingSignup = JSON.parse(pendingJson) as PendingSignup;

        if (
          typeof pendingSignup.username !== "string" ||
          typeof pendingSignup.passwordHash !== "string" ||
          typeof pendingSignup.passwordFingerprint !== "string"
        ) {
          throw new Error("Invalid pending signup data");
        }
      } catch {
        await clearPendingSignup(email);

        return reply.code(400).send({
          message:
            "Your pending signup is invalid or expired. Please sign up again."
        });
      }

      // Recheck the email in case another request created it meanwhile.
      const [existingEmail] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingEmail) {
        await clearPendingSignup(email);

        return reply.code(409).send({
          message: "An account already exists for this email."
        });
      }

      // Recheck the password fingerprint before inserting.
      const [existingFingerprint] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          eq(users.passwordFingerprint, pendingSignup.passwordFingerprint)
        )
        .limit(1);

      if (existingFingerprint) {
        await clearPendingSignup(email);

        return reply.code(409).send({
          message:
            "This password has already been used. Please choose a different password."
        });
      }

      try {
        await db.insert(users).values({
          email,
          username: pendingSignup.username,
          passwordHash: pendingSignup.passwordHash,
          passwordFingerprint: pendingSignup.passwordFingerprint,
          emailVerifiedAt: new Date()
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          // Handle concurrent signup/verification requests safely.
          const [duplicateEmail] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          const [duplicateFingerprint] = await db
            .select({ id: users.id })
            .from(users)
            .where(
              eq(
                users.passwordFingerprint,
                pendingSignup.passwordFingerprint
              )
            )
            .limit(1);

          await clearPendingSignup(email);

          if (duplicateFingerprint) {
            return reply.code(409).send({
              message:
                "This password has already been used. Please choose a different password."
            });
          }

          if (duplicateEmail) {
            return reply.code(409).send({
              message: "An account already exists for this email."
            });
          }
        }

        throw error;
      }

      await clearPendingSignup(email);

      return reply.send({
        message: "Email verified. Your account has been created. You can now sign in."
      });
    }
  );

  // RESEND OTP
  // Resend only for a pending signup stored in Redis.
  app.post<{ Body: { email?: string } }>(
    "/resend-otp",
    async (request, reply) => {
      const ipAllowed = await checkRateLimit(
        `limit:otp-resend:ip:${request.ip}`,
        5,
        900
      );

      if (!ipAllowed) {
        return reply.code(429).send({
          message: "Too many requests. Try again later."
        });
      }

      const email = normalizeEmail(request.body?.email ?? "");

      if (emailPattern.test(email) && email !== env.ADMIN_EMAIL) {
        const pendingKey = `signup:pending:${email}`;
        const pendingJson = await redis.get(pendingKey);

        if (pendingJson) {
          try {
            const pending = JSON.parse(pendingJson) as PendingSignup;

            if (
              typeof pending.username === "string" &&
              typeof pending.passwordHash === "string" &&
              typeof pending.passwordFingerprint === "string"
            ) {
              // Refresh the pending signup's lifetime along with the new OTP.
              await redis.expire(pendingKey, env.OTP_TTL_SECONDS);

              try {
                await storeAndSendOtp(email);
              } catch (error) {
                request.log.error(
                  { err: error },
                  "OTP resend failed"
                );

                try {
                  await clearPendingSignup(email);
                } catch (cleanupError) {
                  request.log.error(
                    { err: cleanupError },
                    "Failed to clean up pending signup after resend failure"
                  );
                }

                return reply.code(503).send({
                  message:
                    "The verification email could not be sent. Your pending signup was cleared; please sign up again."
                });
              }
            } else {
              await clearPendingSignup(email);
            }
          } catch (error) {
            request.log.error(
              { err: error },
              "Invalid pending signup data"
            );

            await clearPendingSignup(email);
          }
        }
      }

      return reply.code(202).send({
        message:
          "If a pending signup exists, a new verification code has been sent."
      });
    }
  );

  // LOGIN
  app.post<{ Body: LoginBody }>("/login", async (request, reply) => {
    const ipAllowed = await checkRateLimit(
      `limit:login:ip:${request.ip}`,
      30,
      900
    );

    if (!ipAllowed) {
      return reply.code(429).send({
        message: "Too many login attempts."
      });
    }

    const email = normalizeEmail(request.body?.email ?? "");
    const password = request.body?.password ?? "";

    if (
      !emailPattern.test(email) ||
      email.length > 254 ||
      password.length === 0 ||
      password.length > 128
    ) {
      return reply.code(400).send({
        message: "Invalid email or password."
      });
    }

    const failureKey = `login:fail:${emailRateLimitKey(email)}`;
    const failures = Number((await redis.get(failureKey)) ?? "0");

    if (failures >= 5) {
      return reply.code(429).send({
        message: "Too many failed login attempts. Try again later."
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let passwordValid = false;

    if (user) {
      try {
        passwordValid = await argon2.verify(
          user.passwordHash,
          password
        );
      } catch {
        passwordValid = false;
      }
    }

    if (!user || !passwordValid) {
      const count = await redis.incr(failureKey);

      if (count === 1) {
        await redis.expire(failureKey, 900);
      }

      // Queue one notification when the account first reaches five
      // failed attempts. Do not send another on every locked request.
      if (count === 5 && user) {
        try {
          const emailContent = getAccountLockedEmailContent();

          await db.insert(emailOutbox).values({
            toEmail: user.email,
            subject: emailContent.subject,
            body: emailContent.body
          });

          await processEmailOutbox();
        } catch (error) {
          request.log.error(
            { err: error },
            "Failed to queue or process account-lock notification"
          );
        }
      }

      return reply.code(count >= 5 ? 429 : 401).send({
        message:
          count >= 5
            ? "Too many failed login attempts. Try again later."
            : "Invalid email or password."
      });
    }

    if (!user.emailVerifiedAt) {
      return reply.code(403).send({
        message: "Please verify your email before signing in."
      });
    }

    await redis.del(failureKey);

    await issueSession(app, reply, {
      id: user.id,
      role: user.role
    });

    return reply.send({
      message: "Login successful.",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  });

  // REFRESH SESSION
  app.post("/refresh", async (request, reply) => {
    const oldToken = request.cookies[refreshCookie];

    if (!oldToken) {
      clearSessionCookies(reply);

      return reply.code(401).send({
        message: "Session expired. Sign in again."
      });
    }

    const oldHash = hashRefreshToken(oldToken);

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, oldHash))
      .limit(1);

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      clearSessionCookies(reply);

      return reply.code(401).send({
        message: "Session expired. Sign in again."
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user || !user.emailVerifiedAt) {
      clearSessionCookies(reply);

      return reply.code(401).send({
        message: "Session expired. Sign in again."
      });
    }

    const newToken = generateRefreshToken();

    const expiresAt = new Date(
      Date.now() + durationToMs(env.REFRESH_TOKEN_TTL)
    );

    const rotated = await db
      .update(sessions)
      .set({
        refreshTokenHash: hashRefreshToken(newToken),
        expiresAt
      })
      .where(
        and(
          eq(sessions.id, session.id),
          eq(sessions.refreshTokenHash, oldHash),
          isNull(sessions.revokedAt)
        )
      )
      .returning({ id: sessions.id });

    if (!rotated.length) {
      clearSessionCookies(reply);

      return reply.code(401).send({
        message: "Session expired. Sign in again."
      });
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, sid: session.id, role: user.role },
      { expiresIn: env.ACCESS_TOKEN_TTL }
    );

    setSessionCookies(app, reply, accessToken, newToken);

    return reply.send({
      message: "Session refreshed.",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  });

  // LOGOUT
  app.post("/logout", async (request, reply) => {
    const refreshToken = request.cookies[refreshCookie];
    const accessToken = request.cookies[accessCookie];

    if (refreshToken) {
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(
          eq(
            sessions.refreshTokenHash,
            hashRefreshToken(refreshToken)
          )
        );
    }

    if (accessToken) {
      try {
        const payload = app.jwt.verify(accessToken) as {
          sid?: string;
        };

        if (payload.sid) {
          await db
            .update(sessions)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(sessions.id, payload.sid),
                isNull(sessions.revokedAt)
              )
            );
        }
      } catch {
        // Clear cookies even if the access token is already invalid.
      }
    }

    clearSessionCookies(reply);

    return reply.send({
      message: "Logged out successfully."
    });
  });
}