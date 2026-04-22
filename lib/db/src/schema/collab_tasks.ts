import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const collabTasksTable = pgTable("collab_tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  assignee: text("assignee"),
  category: text("category"),
  dueDate: text("due_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCollabTaskSchema = createInsertSchema(collabTasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CollabTask = typeof collabTasksTable.$inferSelect;
export type InsertCollabTask = z.infer<typeof insertCollabTaskSchema>;
