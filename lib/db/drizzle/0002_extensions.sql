ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "for_client" text;

CREATE TABLE IF NOT EXISTS "project_chat_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "project_id" integer NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" text,
  "chat_type" text NOT NULL DEFAULT 'design',
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

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
);
