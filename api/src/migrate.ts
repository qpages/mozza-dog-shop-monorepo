import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const migrationsFolder = join(
  dirname(fileURLToPath(import.meta.url)),
  "../drizzle",
);
if (!existsSync(migrationsFolder)) {
  console.error(`migrations folder not found: ${migrationsFolder}`);
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

try {
  console.log("applying database migrations");
  await migrate(db, { migrationsFolder });
  console.log("database migrations applied");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
