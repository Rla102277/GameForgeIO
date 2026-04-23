import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, storyboardNodesTable, projectsTable, rulesTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

router.get("/projects/:projectId/storyboard-nodes", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const nodes = await db.select().from(storyboardNodesTable)
    .where(eq(storyboardNodesTable.projectId, projectId))
    .orderBy(asc(storyboardNodesTable.position), asc(storyboardNodesTable.createdAt));
  res.json(nodes);
});

router.post("/projects/:projectId/storyboard-nodes", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const { title, content = "", status = "idea", type = "rule_variant", parentId, linkedRuleTitle, color = "blue", position = 0 } = req.body;
  if (!title) { res.status(400).json({ error: "Title is required" }); return; }
  const [node] = await db.insert(storyboardNodesTable).values({ projectId, title, content, status, type, parentId: parentId ?? null, linkedRuleTitle: linkedRuleTitle ?? null, color, position }).returning();
  res.json(node);
});

router.put("/projects/:projectId/storyboard-nodes/:nodeId", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const nodeId = parseInt(req.params.nodeId, 10);
  if (isNaN(projectId) || isNaN(nodeId)) { res.status(400).json({ error: "Invalid IDs" }); return; }
  const { title, content, status, type, parentId, linkedRuleTitle, color, position } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (status !== undefined) updates.status = status;
  if (type !== undefined) updates.type = type;
  if (parentId !== undefined) updates.parentId = parentId;
  if (linkedRuleTitle !== undefined) updates.linkedRuleTitle = linkedRuleTitle;
  if (color !== undefined) updates.color = color;
  if (position !== undefined) updates.position = position;
  const [node] = await db.update(storyboardNodesTable).set(updates).where(and(eq(storyboardNodesTable.id, nodeId), eq(storyboardNodesTable.projectId, projectId))).returning();
  if (!node) { res.status(404).json({ error: "Node not found" }); return; }
  res.json(node);
});

router.delete("/projects/:projectId/storyboard-nodes/:nodeId", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const nodeId = parseInt(req.params.nodeId, 10);
  if (isNaN(projectId) || isNaN(nodeId)) { res.status(400).json({ error: "Invalid IDs" }); return; }
  await db.delete(storyboardNodesTable).where(and(eq(storyboardNodesTable.id, nodeId), eq(storyboardNodesTable.projectId, projectId)));
  res.json({ success: true });
});

router.post("/projects/:projectId/storyboard-nodes/:nodeId/ai-suggest", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const nodeId = parseInt(req.params.nodeId, 10);
  if (isNaN(projectId) || isNaN(nodeId)) { res.status(400).json({ error: "Invalid IDs" }); return; }

  const [node] = await db.select().from(storyboardNodesTable).where(eq(storyboardNodesTable.id, nodeId));
  if (!node) { res.status(404).json({ error: "Node not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const rules = await db.select({ title: rulesTable.title, content: rulesTable.content, category: rulesTable.category }).from(rulesTable).where(eq(rulesTable.projectId, projectId)).limit(15);

  const prompt = `You are a board game designer helping explore rule variant ideas for "${project.name}" (${project.genre || "strategy"} game).

The designer has this storyboard node:
Title: "${node.title}"
Content: "${node.content}"
Type: ${node.type}

Existing rules for context:
${rules.map(r => `- ${r.title}: ${r.content?.slice(0, 100)}`).join("\n") || "None yet"}

Generate 3 alternative or branching variants of this idea. These should explore different design directions — simpler, more complex, or taking a completely different approach to the same problem.

Return ONLY a JSON array:
[
  {"title": "Variant title", "content": "Description of this variant approach", "color": "blue|amber|green|purple|red"},
  ...
]`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    const suggestions = match ? JSON.parse(match[0]) : [];
    res.json({ suggestions });
  } catch {
    res.status(500).json({ error: "AI suggest failed" });
  }
});

export default router;
