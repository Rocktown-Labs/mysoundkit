import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
  path: "../../apps/server/.env",
});

export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  dialect: "postgresql",
  out: "./src/migrations",
  schema: [
    "./src/schema/app.ts",
    "./src/schema/auth.ts",
    "./src/schema/commerce.ts",
    "./src/schema/communities.ts",
    "./src/schema/payments.ts",
    "./src/schema/plans.ts",
    "./src/schema/referrals.ts",
  ],
});
