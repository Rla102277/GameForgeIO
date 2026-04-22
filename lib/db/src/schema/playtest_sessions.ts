import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const playtestSessionsTable = pgTable("playtest_sessions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  date: text("date"),
  playerCount: integer("player_count"),
  duration: integer("duration"),
  rating: integer("rating"),
  notes: text("notes"),
  issues: jsonb("issues").$type<string[]>().default([]),
  positives: jsonb("positives").$type<string[]>().default([]),
  suggestions: jsonb("suggestions").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPlaytestSessionSchema = createInsertSchema(playtestSessionsTable).omit({
  id: true,
  createdAt: true,
});

export type PlaytestSession = typeof playtestSessionsTable.$inferSelect;
export type InsertPlaytestSession = z.infer<typeof insertPlaytestSessionSchema>;
