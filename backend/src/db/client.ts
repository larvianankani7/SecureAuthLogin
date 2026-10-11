import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
import { env } from "../config/env.js";

export const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10
});

export const db = drizzle(queryClient, { schema });

export async function checkDatabase(): Promise<void> {
  await queryClient`SELECT 1`;
}

export async function closeDatabase(): Promise<void> {
  await queryClient.end();
}