import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const playtestFeedbackTable = pgTable("playtest_feedback", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  testerName: text("tester_name"),
  sessionCode: text("session_code"),
  overallRating: integer("overall_rating"),
  funRating: integer("fun_rating"),
  balanceRating: integer("balance_rating"),
  clarityRating: integer("clarity_rating"),
  whatWorked: text("what_worked"),
  whatDidnt: text("what_didnt"),
  suggestions: text("suggestions"),
  wouldPlay: boolean("would_play"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PlaytestFeedback = typeof playtestFeedbackTable.$inferSelect;
