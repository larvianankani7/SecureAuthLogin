
import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../db/client.js";
import { redis } from "../../db/redis.js";
import { blockedEmails, sessions, users } from "../../db/schema.js";
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
import { sendOtpEmail } from "../email/service.js";

type SignupBody = {
  email?: string;
  password?: string;
  username?: string;
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
    sameSite: "lax" as const
  };
}

function setSessionCookies(
  app: FastifyInstance,
  reply: Parameters<FastifyInstance["jwt"]["sign"]>[0] extends never
    ? never
    : import("fastify").FastifyReply,
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

function clearSessionCookies(
  reply: import("fastify").FastifyReply
): void {
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
  reply: import("fastify").FastifyReply,
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

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: SignupBody }>("/signup", async (request, reply) => {
    const ipAllowed = await checkRateLimit(
      `limit:signup:ip:${request.ip}`,
      5,
      900
    );

    if (!ipAllowed) {
      return reply.code(429).send({ message: "Too many requests. Try again later." });
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
        message: "Enter a valid email, a password of 8–128 characters, and a username of 2–32 characters."
      });
    }

    if (email === env.ADMIN_EMAIL) {
      return reply.code(409).send({ message: "This email cannot be registered." });
    }

    const emailAllowed = await checkRateLimit(
      `limit:signup:email:${emailRateLimitKey(email)}`,
      3,
      3600
    );

    if (!emailAllowed) {
      return reply.code(429).send({ message: "Too many signup attempts." });
    }

    const [blocked] = await db
      .select({ email: blockedEmails.email })
      .from(blockedEmails)
      .where(eq(blockedEmails.email, email))
      .limit(1);

    if (blocked) {
      return reply.code(403).send({ message: "This email cannot be registered." });
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

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id
    });
    const passwordFingerprint = generatePasswordFingerprint(password);

    let created;
    try {
      const [inserted] = await db
        .insert(users)
        .values({ email, username, passwordHash, passwordFingerprint })
        .returning({ id: users.id });
      created = inserted;
    } catch (error: any) {
      if ((error.code === '23505' || error.cause?.code === '23505') && (error.constraint === 'users_password_fingerprint_unique' || error.cause?.constraint_name === 'users_password_fingerprint_unique')) {
        return reply.code(400).send({
          message: "This password has already been used. Please choose a different password."
        });
      }
      throw error;
    }

    try {
      await storeAndSendOtp(email);
    } catch (error) {
      request.log.error({ err: error }, "OTP email delivery failed");
      return reply.code(503).send({
        message: "Your account was created but the verification email could not be sent. Try resending the code."
      });
    }

    return reply.code(201).send({
      message: "Account created. Check your email for the verification code.",
      userId: created.id
    });
  });

  app.post<{ Body: VerifyBody }>(
    "/verify-otp",
    async (request, reply) => {
      if (
        !(await checkRateLimit(
          `limit:otp:ip:${request.ip}`,
          20,
          900
        ))
      ) {
        return reply.code(429).send({ message: "Too many verification attempts." });
      }

      const email = normalizeEmail(request.body?.email ?? "");
      const code = request.body?.code ?? "";

      if (!emailPattern.test(email) || !/^\d{6}$/.test(code)) {
        return reply.code(400).send({ message: "Invalid verification request." });
      }

      const attemptsKey = `otp:attempts:${email}`;
      const attempts = Number((await redis.get(attemptsKey)) ?? "0");

      if (attempts >= env.OTP_MAX_ATTEMPTS) {
        return reply.code(429).send({
          message: "Too many incorrect codes. Request a new code."
        });
      }

      const storedHash = await redis.get(`otp:signup:${email}`);

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

      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return reply.code(400).send({ message: "Invalid verification request." });
      }

      await db
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, user.id));

      await redis.del(`otp:signup:${email}`);
      await redis.del(attemptsKey);

      return reply.send({
        message: "Email verified. You can now sign in."
      });
    }
  );

  app.post<{ Body: { email?: string } }>(
    "/resend-otp",
    async (request, reply) => {
      if (
        !(await checkRateLimit(
          `limit:otp-resend:ip:${request.ip}`,
          5,
          900
        ))
      ) {
        return reply.code(429).send({ message: "Too many requests. Try again later." });
      }

      const email = normalizeEmail(request.body?.email ?? "");

      if (emailPattern.test(email) && email !== env.ADMIN_EMAIL) {
        const [user] = await db
          .select({
            id: users.id,
            emailVerifiedAt: users.emailVerifiedAt
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (user && !user.emailVerifiedAt) {
          try {
            await storeAndSendOtp(email);
          } catch (error) {
            request.log.error({ err: error }, "OTP resend failed");
            return reply.code(503).send({
              message: "The verification email could not be sent."
            });
          }
        }
      }

      return reply.code(202).send({
        message: "If the account needs verification, a new code has been sent."
      });
    }
  );

  app.post<{ Body: LoginBody }>("/login", async (request, reply) => {
    if (
      !(await checkRateLimit(
        `limit:login:ip:${request.ip}`,
        30,
        900
      ))
    ) {
      return reply.code(429).send({ message: "Too many login attempts." });
    }

    const email = normalizeEmail(request.body?.email ?? "");
    const password = request.body?.password ?? "";

    if (
      !emailPattern.test(email) ||
      email.length > 254 ||
      password.length === 0 ||
      password.length > 128
    ) {
      return reply.code(400).send({ message: "Invalid email or password." });
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
        passwordValid = await argon2.verify(user.passwordHash, password);
      } catch {
        passwordValid = false;
      }
    }

    if (!user || !passwordValid) {
      const count = await redis.incr(failureKey);
      if (count === 1) await redis.expire(failureKey, 900);

      return reply.code(count >= 5 ? 429 : 401).send({
        message: count >= 5
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
    await issueSession(app, reply, { id: user.id, role: user.role });

    return reply.send({
      message: "Login successful.",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });
  });

  app.post("/refresh", async (request, reply) => {
    const oldToken = request.cookies[refreshCookie];

    if (!oldToken) {
      clearSessionCookies(reply);
      return reply.code(401).send({ message: "Session expired. Sign in again." });
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
      return reply.code(401).send({ message: "Session expired. Sign in again." });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user || !user.emailVerifiedAt) {
      clearSessionCookies(reply);
      return reply.code(401).send({ message: "Session expired. Sign in again." });
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
      return reply.code(401).send({ message: "Session expired. Sign in again." });
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
        role: user.role
      }
    });
  });

  app.post("/logout", async (request, reply) => {
    const refreshToken = request.cookies[refreshCookie];
    const accessToken = request.cookies[accessCookie];

    if (refreshToken) {
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.refreshTokenHash, hashRefreshToken(refreshToken)));
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
        // The cookies are cleared even if the access token is already invalid.
      }
    }

    clearSessionCookies(reply);
    return reply.send({ message: "Logged out successfully." });
  });
}