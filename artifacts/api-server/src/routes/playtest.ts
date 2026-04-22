import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, playtestSessionsTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateSessionBody = z.object({
  title: z.string(),
  date: z.string().optional(),
  playerCount: z.number().optional(),
  duration: z.number().optional(),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
  issues: z.array(z.string()).optional().default([]),
  positives: z.array(z.string()).optional().default([]),
  suggestions: z.array(z.string()).optional().default([]),
});

router.get("/projects/:projectId/playtest-sessions", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const sessions = await db.select().from(playtestSessionsTable)
    .where(eq(playtestSessionsTable.projectId, projectId))
    .orderBy(desc(playtestSessionsTable.createdAt));
  res.json(sessions);
});

router.post("/projects/:projectId/playtest-sessions", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [session] = await db.insert(playtestSessionsTable).values({ ...parsed.data, projectId }).returning();
  res.status(201).json(session);
});

router.delete("/projects/:projectId/playtest-sessions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [deleted] = await db.delete(playtestSessionsTable).where(eq(playtestSessionsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Session not found" }); return; }
  res.sendStatus(204);
});

export default router;
