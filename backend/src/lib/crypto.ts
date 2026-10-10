
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual
} from "node:crypto";
import { env } from "../config/env.js";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(email: string, code: string): string {
  return createHmac("sha256", env.JWT_SECRET)
    .update(`signup-otp:${email}:${code}`)
    .digest("hex");
}

export function generatePasswordFingerprint(password: string): string {
  return createHmac("sha256", env.PASSWORD_FINGERPRINT_SECRET)
    .update(password)
    .digest("hex");
}

export function safeHashCompare(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");

  return a.length === b.length && timingSafeEqual(a, b);
}

export function durationToMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) throw new Error(`Invalid duration: ${value}`);

  const amount = Number(match[1]);
  const units: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
  };

  return amount * units[match[2]];
}

export function emailRateLimitKey(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}