import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
  path: process.env.ENV_FILE ?? "../.env"
});

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
});