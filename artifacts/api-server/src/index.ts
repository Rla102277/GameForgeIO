import path from "path";
import app from "./app";
import { logger } from "./lib/logger";
import { db, pool } from "@workspace/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Stamp the initial migration as already applied when the DB has tables but no
// migration tracking table yet (happens when the schema was set up via drizzle push).
async function stampInitialMigrationIfNeeded() {
  const client = await pool.connect();
  try {
    const [migrationsCountResult, projectsTableResult] = await Promise.all([
      client.query(
        `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'`,
      ),
      client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects' AND table_schema = 'public')`,
      ),
    ]);

    // Check how many rows are in the migrations tracking table (0 means not stamped yet)
    const migrationsSchemaTableExists = Number(migrationsCountResult.rows[0].count) > 0;
    let migrationsRowCount = 0;
    if (migrationsSchemaTableExists) {
      const rowCount = await client.query(`SELECT COUNT(*) FROM drizzle.__drizzle_migrations`);
      migrationsRowCount = Number(rowCount.rows[0].count);
    }
    const projectsTableExists = projectsTableResult.rows[0].exists;

    if (migrationsRowCount === 0 && projectsTableExists) {
      logger.info("Stamping initial migration as already applied (pre-existing schema detected)");
      // Drizzle uses schema "drizzle" and table "__drizzle_migrations"
      await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `);
      // Insert with a created_at well beyond the migration's "when" timestamp
      // so Drizzle's timestamp comparison skips it (created_at > folderMillis)
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
        ["c529673ae52c1b789ec078d1003897f83a63db46d7b3f37d84a6b862bcd35ca5", Date.now()],
      );
      logger.info("Initial migration stamped in drizzle.__drizzle_migrations");
    }
  } finally {
    client.release();
  }
}

async function start() {
  try {
    // __dirname is set by the esbuild banner to the dist/ folder.
    // Navigate up 3 levels (dist → api-server → artifacts → workspace root)
    // then into lib/db/drizzle where migration files live.
    const migrationsFolder = path.resolve(__dirname, "../../../lib/db/drizzle");
    logger.info({ migrationsFolder }, "Running database migrations");
    await stampInitialMigrationIfNeeded();
    await migrate(db, { migrationsFolder });
    logger.info("Database migrations complete");
  } catch (err) {
    logger.error({ err }, "Database migration failed");
    process.exit(1);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start();
