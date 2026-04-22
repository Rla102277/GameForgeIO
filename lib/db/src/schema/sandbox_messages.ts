import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const sandboxMessagesTable = pgTable("sandbox_messages", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSandboxMessageSchema = createInsertSchema(sandboxMessagesTable).omit({ id: true, createdAt: true });
export type InsertSandboxMessage = z.infer<typeof insertSandboxMessageSchema>;
export type SandboxMessage = typeof sandboxMessagesTable.$inferSelect;
