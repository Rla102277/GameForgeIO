import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, playersTable, entitiesTable, propertiesTable, rulesTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { sql } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const CreatePlayerBody = z.object({
  name: z.string(),
  archetype: z.string().optional(),
  description: z.string().optional(),
  startingResources: z.record(z.union([z.number(), z.string()])).optional(),
  victoryCondition: z.string().optional(),
  specialAbility: z.string().optional(),
  playstyle: z.string().optional(),
});

const UpdatePlayerBody = CreatePlayerBody.partial();

router.get("/projects/:projectId/players", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const players = await db.select().from(playersTable).where(eq(playersTable.projectId, projectId)).orderBy(asc(playersTable.createdAt));
  res.json(players);
});

router.post("/projects/:projectId/players", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [player] = await db.insert(playersTable).values({ ...parsed.data, projectId }).returning();
  res.status(201).json(player);
});

router.patch("/projects/:projectId/players/:id", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const id = parseInt(req.params.id, 10);
  if (isNaN(projectId) || isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = UpdatePlayerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }
  updateData.updatedAt = new Date();
  const [player] = await db.update(playersTable).set(updateData).where(eq(playersTable.id, id)).returning();
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(player);
});

router.delete("/projects/:projectId/players/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [deleted] = await db.delete(playersTable).where(eq(playersTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Player not found" }); return; }
  res.sendStatus(204);
});

// AI generate player archetypes
router.post("/projects/:projectId/players/ai-generate", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const entities = await db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId));
  const entityIds = entities.map(e => e.id);
  let propContext = "";
  if (entityIds.length > 0) {
    const allProps = await db.select().from(propertiesTable).where(sql`${propertiesTable.entityId} = ANY(${sql.raw(`ARRAY[${entityIds.join(",")}]`)})`);
    propContext = entities.map(e => {
      const props = allProps.filter(p => p.entityId === e.id);
      return `- ${e.name} [${e.type}]: ${props.map(p => `${p.name}(${p.dataType})`).join(", ")}`;
    }).join("\n");
  }
  const rules = await db.select().from(rulesTable).where(eq(rulesTable.projectId, projectId)).orderBy(asc(rulesTable.priority));
  const rulesContext = rules.map(r => `- ${r.title}: ${r.content}`).join("\n");

  const { count = 3 } = req.body;

  const prompt = `You are a board game designer. Based on this game's entities and rules, generate ${count} distinct player archetypes.

Entities:
${propContext || "(none yet)"}

Rules:
${rulesContext || "(none yet)"}

Return a JSON array of ${count} player archetypes. Each must have:
{
  "name": "Archetype Name",
  "archetype": "short label (e.g. Aggressor, Builder, Diplomat)",
  "description": "2-3 sentence description",
  "victoryCondition": "specific win condition",
  "specialAbility": "one unique special ability",
  "playstyle": "Aggressive | Economic | Defensive | Diplomatic | Hybrid",
  "startingResources": { "key": value }
}

Only return the JSON array, nothing else.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { res.status(500).json({ error: "Could not parse AI response" }); return; }
    const players = JSON.parse(jsonMatch[0]);
    res.json(players);
  } catch (e) {
    res.status(500).json({ error: "AI generation failed" });
  }
});

export default router;
