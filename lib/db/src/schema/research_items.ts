import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const researchItemsTable = pgTable("research_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  sourceUrl: text("source_url"),
  type: text("type").notNull().default("text"), // "text" | "url" | "ai_note"
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertResearchItemSchema = createInsertSchema(researchItemsTable).omit({ id: true, createdAt: true });
export type ResearchItem = typeof researchItemsTable.$inferSelect;
export type InsertResearchItem = z.infer<typeof insertResearchItemSchema>;
