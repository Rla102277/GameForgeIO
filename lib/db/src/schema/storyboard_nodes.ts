import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const storyboardNodesTable = pgTable("storyboard_nodes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  status: text("status").notNull().default("idea"),
  type: text("type").notNull().default("rule_variant"),
  linkedRuleTitle: text("linked_rule_title"),
  color: text("color").notNull().default("blue"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertStoryboardNodeSchema = createInsertSchema(storyboardNodesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type StoryboardNode = typeof storyboardNodesTable.$inferSelect;
export type InsertStoryboardNode = z.infer<typeof insertStoryboardNodeSchema>;
