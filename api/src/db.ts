import fp from "fastify-plugin";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as adminSchema from "./admin/schema.js";
import * as shootingSchema from "./shooting/schema.js";

const schema = { ...shootingSchema, ...adminSchema };

export type Database = PostgresJsDatabase<typeof schema>;

export default fp(
  async (app) => {
    const sql = postgres(app.config.DATABASE_URL, { max: 10 });
    const db = drizzle(sql, { schema });

    app.decorate("db", db);
    app.addHook("onClose", async () => {
      await sql.end({ timeout: 5 });
    });
  },
  { name: "db" },
);
