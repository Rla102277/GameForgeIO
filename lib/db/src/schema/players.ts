import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  archetype: text("archetype"),
  description: text("description"),
  startingResources: jsonb("starting_resources").$type<Record<string, number | string>>().default({}),
  victoryCondition: text("victory_condition"),
  specialAbility: text("special_ability"),
  playstyle: text("playstyle"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Player = typeof playersTable.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
