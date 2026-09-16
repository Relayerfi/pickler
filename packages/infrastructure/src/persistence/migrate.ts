import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_MIGRATION_URL;
if (!url) {
  throw new Error("DATABASE_MIGRATION_URL is required (direct or session connection)");
}
const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 });
try {
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
    migrationsSchema: "pickler_migrations",
  });
  console.log("Pickler migrations applied.");
} finally {
  await pool.end();
}
