import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, rulesTable, entitiesTable, propertiesTable, sandboxMessagesTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  ListRulesParams,
  CreateRuleParams,
  CreateRuleBody,
  UpdateRuleParams,
  UpdateRuleBody,
  DeleteRuleParams,
  SendRulesSandboxMessageParams,
  SendRulesSandboxMessageBody,
  GetRulesSandboxHistoryParams,
  ClearRulesSandboxHistoryParams,
} from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/projects/:projectId/rules", async (req, res): Promise<void> => {
  const params = ListRulesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rules = await db.select().from(rulesTable).where(eq(rulesTable.projectId, params.data.projectId)).orderBy(asc(rulesTable.priority));
  res.json(rules);
});

router.post("/projects/:projectId/rules", async (req, res): Promise<void> => {
  const params = CreateRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [rule] = await db.insert(rulesTable).values({ ...parsed.data, projectId: params.data.projectId, priority: parsed.data.priority ?? 0 }).returning();
  res.status(201).json(rule);
});

router.patch("/projects/:projectId/rules/:id", async (req, res): Promise<void> => {
  const params = UpdateRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }
  const [rule] = await db.update(rulesTable).set(updateData).where(
    and(eq(rulesTable.id, params.data.id), eq(rulesTable.projectId, params.data.projectId))
  ).returning();
  if (!rule) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  res.json(rule);
});

router.delete("/projects/:projectId/rules/:id", async (req, res): Promise<void> => {
  const params = DeleteRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(rulesTable).where(
    and(eq(rulesTable.id, params.data.id), eq(rulesTable.projectId, params.data.projectId))
  ).returning();
  if (!deleted) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  res.sendStatus(204);
});

// Rules Sandbox — SSE streaming with full project context
router.post("/projects/:projectId/rules-sandbox", async (req, res): Promise<void> => {
  const params = SendRulesSandboxMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SendRulesSandboxMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const projectId = params.data.projectId;

  // Build full project ontology context
  const entities = await db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId));
  let propertyContext = "";
  if (entities.length > 0) {
    const entityIds = entities.map((e) => e.id);
    const allProps = await db.select().from(propertiesTable).where(
      sql`${propertiesTable.entityId} = ANY(${sql.raw(`ARRAY[${entityIds.join(",")}]`)})`
    );
    for (const entity of entities) {
      const props = allProps.filter((p) => p.entityId === entity.id);
      const propStr = props.map((p) => `    - ${p.name} (${p.dataType}${p.unit ? `, unit: ${p.unit}` : ""}${p.defaultValue ? `, default: ${p.defaultValue}` : ""}${p.minValue ? `, min: ${p.minValue}` : ""}${p.maxValue ? `, max: ${p.maxValue}` : ""})`).join("\n");
      propertyContext += `\n  Entity: ${entity.name} [${entity.type}]${entity.description ? ` — ${entity.description}` : ""}\n${propStr || "    (no properties)"}`;
    }
  }

  const rules = await db.select().from(rulesTable).where(eq(rulesTable.projectId, projectId)).orderBy(asc(rulesTable.priority));
  const rulesContext = rules.map((r) => `  [${r.category ?? "general"}] ${r.title}: ${r.content}`).join("\n");

  const systemPrompt = `You are an expert board game designer assistant with deep knowledge of game mechanics, economy design, and rules balancing.

You have full context of the current board game project:

## Entities & Ontology
${propertyContext || "(no entities defined yet)"}

## Current Rules
${rulesContext || "(no rules defined yet)"}

Your role is to:
- Suggest mechanics and improvements based on the ontology
- Flag potential rule conflicts or balance issues
- Analyze the economic implications of current properties
- Recommend ways to improve the game design

Be specific, reference the actual entities and rules by name. Be concise but thorough.`;

  // Load chat history for context
  const history = await db.select().from(sandboxMessagesTable)
    .where(eq(sandboxMessagesTable.projectId, projectId))
    .orderBy(asc(sandboxMessagesTable.createdAt))
    .limit(20);

  const chatMessages: { role: "user" | "assistant"; content: string }[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  chatMessages.push({ role: "user", content: parsed.data.message });

  // Save user message
  await db.insert(sandboxMessagesTable).values({ projectId, role: "user", content: parsed.data.message });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: chatMessages,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullResponse += event.delta.text;
      res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
    }
  }

  // Save assistant response
  await db.insert(sandboxMessagesTable).values({ projectId, role: "assistant", content: fullResponse });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.get("/projects/:projectId/rules-sandbox/history", async (req, res): Promise<void> => {
  const params = GetRulesSandboxHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const messages = await db.select().from(sandboxMessagesTable)
    .where(eq(sandboxMessagesTable.projectId, params.data.projectId))
    .orderBy(asc(sandboxMessagesTable.createdAt));
  res.json(messages);
});

router.delete("/projects/:projectId/rules-sandbox/history", async (req, res): Promise<void> => {
  const params = ClearRulesSandboxHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(sandboxMessagesTable).where(eq(sandboxMessagesTable.projectId, params.data.projectId));
  res.sendStatus(204);
});

export default router;
