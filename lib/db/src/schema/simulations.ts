import { pgTable, text, serial, integer, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const simulationsTable = pgTable("simulations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  label: text("label"),
  config: jsonb("config").notNull(),
  percentile10: real("percentile_10").notNull(),
  percentile50: real("percentile_50").notNull(),
  percentile90: real("percentile_90").notNull(),
  mean: real("mean").notNull(),
  stdDev: real("std_dev").notNull(),
  economyHealthScore: real("economy_health_score").notNull(),
  turnData: jsonb("turn_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSimulationSchema = createInsertSchema(simulationsTable).omit({ id: true, createdAt: true });
export type InsertSimulation = z.infer<typeof insertSimulationSchema>;
export type Simulation = typeof simulationsTable.$inferSelect;
