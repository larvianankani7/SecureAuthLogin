import dotenv from "dotenv";

dotenv.config({
  path: process.env.ENV_FILE ?? "../.env"
});

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function booleanValue(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: positiveInteger("PORT", 3000),
  FRONTEND_URL: required("FRONTEND_URL").replace(/\/$/, ""),
  DATABASE_URL: required("DATABASE_URL"),
  REDIS_URL: required("REDIS_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "10m",
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL ?? "7d",
  COOKIE_SECURE: booleanValue("COOKIE_SECURE", false),
  OTP_TTL_SECONDS: positiveInteger("OTP_TTL_SECONDS", 120),
  OTP_MAX_ATTEMPTS: positiveInteger("OTP_MAX_ATTEMPTS", 5),
  SMTP_HOST: required("SMTP_HOST"),
  SMTP_PORT: positiveInteger("SMTP_PORT", 465),
  SMTP_SECURE: booleanValue("SMTP_SECURE", true),
  SMTP_USER: required("SMTP_USER"),
  SMTP_PASS: required("SMTP_PASS"),
  SMTP_FROM: required("SMTP_FROM"),
  ADMIN_EMAIL: required("ADMIN_EMAIL").toLowerCase(),
  ADMIN_PASSWORD: required("ADMIN_PASSWORD"),
  PASSWORD_FINGERPRINT_SECRET: required("PASSWORD_FINGERPRINT_SECRET")
};

if (env.NODE_ENV === "production" && !env.COOKIE_SECURE) {
  throw new Error("COOKIE_SECURE must be true in production");
}

if (env.JWT_SECRET.length < 64) {
  throw new Error("JWT_SECRET must contain at least 64 characters");
}

if (env.PASSWORD_FINGERPRINT_SECRET.length < 32) {
  throw new Error("PASSWORD_FINGERPRINT_SECRET must contain at least 32 characters");
}

if (env.ADMIN_PASSWORD.length < 8) {
  throw new Error("ADMIN_PASSWORD must contain at least 8 characters");
}

if (
  !/^postgres(ql)?:\/\//i.test(env.DATABASE_URL) ||
  !/^rediss?:\/\//i.test(env.REDIS_URL)
) {
  throw new Error("Invalid database or Redis URL");
}