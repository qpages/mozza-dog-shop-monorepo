import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { admins } from "./schema.js";
import { hashPassword } from "./password.js";
import { normalizeEmail } from "../shooting/email.js";
import * as shootingSchema from "../shooting/schema.js";

const schema = { ...shootingSchema, admins };

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!databaseUrl || !email || !password) {
  console.error("DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql, { schema });

try {
  const normalized = normalizeEmail(email);
  const passwordHash = await hashPassword(password);
  const existing = await db.query.admins.findFirst({
    where: eq(admins.email, normalized),
  });

  if (existing) {
    await db
      .update(admins)
      .set({ passwordHash })
      .where(eq(admins.id, existing.id));
    console.log(`admin updated: ${normalized}`);
  } else {
    await db.insert(admins).values({ email: normalized, passwordHash });
    console.log(`admin created: ${normalized}`);
  }
} finally {
  await sql.end();
}
