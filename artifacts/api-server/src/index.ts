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

/**
 * Directly ensures the latest schema changes exist, independent of the
 * migration journal. This is the safety net for production databases that
 * were set up via drizzle push and may have skipped migration files due to
 * timestamp ordering issues in the journal.
 *
 * All statements are fully idempotent — safe to run on every startup.
 */
async function ensureLatestSchema() {
  const client = await pool.connect();
  try {
    logger.info("Ensuring latest schema (idempotent safety pass)");

    // 0001 — user_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_settings" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "provider" text DEFAULT 'anthropic' NOT NULL,
        "model" text DEFAULT 'claude-haiku-4-5' NOT NULL,
        "anthropic_api_key" text,
        "openai_api_key" text,
        "gemini_api_key" text,
        "xai_api_key" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
      )
    `);

    // 0002 — for_client column on projects
    await client.query(`
      ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "for_client" text
    `);

    // 0002 — project_chat_messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "project_chat_messages" (
        "id" serial PRIMARY KEY NOT NULL,
        "project_id" integer NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "user_id" text,
        "chat_type" text NOT NULL DEFAULT 'design',
        "role" text NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    // 0002 — app_users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "app_users" (
        "id" serial PRIMARY KEY NOT NULL,
        "clerk_id" text NOT NULL,
        "email" text NOT NULL,
        "first_name" text,
        "last_name" text,
        "role" text NOT NULL DEFAULT 'user',
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "app_users_clerk_id_unique" UNIQUE("clerk_id")
      )
    `);

    logger.info("Latest schema ensured successfully");
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
    // Safety net: ensure all schema changes are applied regardless of journal state
    await ensureLatestSchema();
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
