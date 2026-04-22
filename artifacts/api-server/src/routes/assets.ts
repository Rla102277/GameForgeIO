import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, assetsTable, entitiesTable, propertiesTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import {
  ListAssetsParams,
  CreateAssetParams,
  CreateAssetBody,
  DeleteAssetParams,
  GenerateCardDescriptionParams,
  GenerateCardDescriptionBody,
  GenerateAssetImageParams,
  GenerateAssetImageBody,
} from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/projects/:projectId/assets", async (req, res): Promise<void> => {
  const params = ListAssetsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const assets = await db.select().from(assetsTable).where(eq(assetsTable.projectId, params.data.projectId));
  res.json(assets);
});

router.post("/projects/:projectId/assets", async (req, res): Promise<void> => {
  const params = CreateAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [asset] = await db.insert(assetsTable).values({ ...parsed.data, projectId: params.data.projectId }).returning();
  res.status(201).json(asset);
});

router.delete("/projects/:projectId/assets/:id", async (req, res): Promise<void> => {
  const params = DeleteAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(assetsTable).where(
    and(eq(assetsTable.id, params.data.id), eq(assetsTable.projectId, params.data.projectId))
  ).returning();
  if (!deleted) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  res.sendStatus(204);
});

// Generate card description using AI (SSE stream)
router.post("/projects/:projectId/generate-card-description", async (req, res): Promise<void> => {
  const params = GenerateCardDescriptionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = GenerateCardDescriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const projectId = params.data.projectId;
  let entityContext = "";

  if (parsed.data.entityId) {
    const [entity] = await db.select().from(entitiesTable).where(
      and(eq(entitiesTable.id, parsed.data.entityId), eq(entitiesTable.projectId, projectId))
    );
    if (entity) {
      const props = await db.select().from(propertiesTable).where(eq(propertiesTable.entityId, entity.id));
      entityContext = `\nEntity: ${entity.name} [${entity.type}]${entity.description ? `: ${entity.description}` : ""}\nProperties: ${props.map((p) => `${p.name}=${p.defaultValue ?? "?"}`).join(", ")}`;
    }
  }

  const prompt = `You are a creative board game card writer. Write a compelling card description for a board game.

Card Name: ${parsed.data.cardName}
Card Type: ${parsed.data.cardType}
${entityContext}
${parsed.data.context ? `Context: ${parsed.data.context}` : ""}

Write two parts:
1. A mechanical description (1-2 sentences about what the card does in the game)
2. Flavor text (1-2 sentences of evocative in-world flavor)

Keep it concise and impactful.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// Generate asset image using OpenAI
router.post("/projects/:projectId/generate-asset-image", async (req, res): Promise<void> => {
  const params = GenerateAssetImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = GenerateAssetImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const stylePrefix = parsed.data.style ? `${parsed.data.style} style board game art: ` : "detailed fantasy board game card art: ";
  const fullPrompt = `${stylePrefix}${parsed.data.prompt}. High quality, suitable for a trading card game.`;
  const size = (parsed.data.size as "1024x1024" | "1536x1024" | "1024x1536") ?? "1024x1024";

  const buffer = await generateImageBuffer(fullPrompt, size);
  res.json({ b64_json: buffer.toString("base64") });
});

export default router;
