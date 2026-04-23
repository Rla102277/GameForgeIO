import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  content: text("content").notNull().default(""),
  color: text("color").notNull().default("slate"),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertNoteSchema = createInsertSchema(notesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Note = typeof notesTable.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
