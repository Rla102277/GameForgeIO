import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const changeLogTable = pgTable("change_log", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  action: text("action").notNull(),
  description: text("description").notNull(),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  author: text("author").default("Designer"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ChangeLog = typeof changeLogTable.$inferSelect;
