import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const projectFilesTable = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  sourceUrl: text("source_url"),
  extractedText: text("extracted_text"),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertProjectFileSchema = createInsertSchema(projectFilesTable).omit({
  id: true,
  createdAt: true,
});

export type ProjectFile = typeof projectFilesTable.$inferSelect;
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;
