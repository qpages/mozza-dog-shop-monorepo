import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/shooting/schema.ts", "./src/admin/schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? "postgres://mozza:mozza@localhost:5432/mozza",
  },
});
