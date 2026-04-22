import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { db, collabTasksTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateTaskBody = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "review", "done"]).optional().default("todo"),
  priority: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
  assignee: z.string().optional(),
  category: z.string().optional(),
  dueDate: z.string().optional(),
});

const UpdateTaskBody = CreateTaskBody.partial();

router.get("/projects/:projectId/tasks", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const tasks = await db.select().from(collabTasksTable).where(eq(collabTasksTable.projectId, projectId)).orderBy(asc(collabTasksTable.createdAt));
  res.json(tasks);
});

router.post("/projects/:projectId/tasks", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [task] = await db.insert(collabTasksTable).values({ ...parsed.data, projectId }).returning();
  res.status(201).json(task);
});

router.patch("/projects/:projectId/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }
  updateData.updatedAt = new Date();
  const [task] = await db.update(collabTasksTable).set(updateData).where(eq(collabTasksTable.id, id)).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(task);
});

router.delete("/projects/:projectId/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [deleted] = await db.delete(collabTasksTable).where(eq(collabTasksTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Task not found" }); return; }
  res.sendStatus(204);
});

export default router;
