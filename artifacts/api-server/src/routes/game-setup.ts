import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import multer from "multer";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const pdfParse = _require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
import { db, projectFilesTable, projectsTable, entitiesTable, propertiesTable, rulesTable, playersTable, changeLogTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { sql } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Get all uploaded files for a project
router.get("/projects/:projectId/files", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const files = await db.select().from(projectFilesTable).where(eq(projectFilesTable.projectId, projectId)).orderBy(projectFilesTable.createdAt);
  res.json(files);
});

// Upload a file and extract text
router.post("/projects/:projectId/files/upload", upload.single("file"), async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }

  let extractedText = "";
  const fileType = req.file.mimetype;

  try {
    if (fileType === "application/pdf") {
      const parsed = await pdfParse(req.file.buffer);
      extractedText = parsed.text.slice(0, 50000);
    } else if (fileType.startsWith("text/") || fileType === "application/json") {
      extractedText = req.file.buffer.toString("utf-8").slice(0, 50000);
    } else {
      extractedText = req.file.buffer.toString("utf-8").slice(0, 50000);
    }
  } catch {
    extractedText = req.file.buffer.toString("utf-8", 0, Math.min(req.file.buffer.length, 50000));
  }

  const [file] = await db.insert(projectFilesTable).values({
    projectId,
    filename: req.file.originalname,
    fileType,
    extractedText,
  }).returning();

  res.status(201).json(file);
});

// Fetch URL and extract text
router.post("/projects/:projectId/files/fetch-url", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const { url } = req.body;
  if (!url) { res.status(400).json({ error: "URL required" }); return; }

  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await response.text();
    // Strip HTML tags to get readable text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50000);

    const [file] = await db.insert(projectFilesTable).values({
      projectId,
      filename: url.split("/").pop()?.slice(0, 100) || "url-content",
      fileType: "text/url",
      sourceUrl: url,
      extractedText: text,
    }).returning();

    res.status(201).json(file);
  } catch (e) {
    res.status(400).json({ error: `Could not fetch URL: ${e}` });
  }
});

// Delete a file
router.delete("/projects/:projectId/files/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(projectFilesTable).where(eq(projectFilesTable.id, id));
  res.sendStatus(204);
});

// AI: Analyze uploaded files + existing context → stream game blueprint
router.post("/projects/:projectId/analyze-and-build", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const files = await db.select().from(projectFilesTable).where(eq(projectFilesTable.projectId, projectId));
  const fileContent = files.map(f => `--- File: ${f.filename} ---\n${f.extractedText || "(empty)"}`).join("\n\n");

  const prompt = `You are an expert board game designer and analyst. Analyze these uploaded files and the game concept, then generate a complete game blueprint in JSON.

Game: "${project.name}"
Genre: ${project.genre || "unknown"}
Description: ${project.description || "none"}

Uploaded Reference Files:
${fileContent || "(no files uploaded — generate from game name/genre/description)"}

Generate a comprehensive board game blueprint as JSON:
{
  "overview": {
    "summary": "2-3 sentence game summary",
    "theme": "thematic description",
    "mechanics": ["mechanic1", "mechanic2"],
    "playerCount": "2-4",
    "duration": "60-90 min",
    "complexity": "Medium"
  },
  "entities": [
    {
      "name": "entity name",
      "type": "Item|Faction|Location|Event",
      "description": "what it is",
      "properties": [
        { "name": "propName", "dataType": "number|string|boolean|enum", "defaultValue": "value", "description": "what it does" }
      ]
    }
  ],
  "rules": [
    { "title": "Rule Title", "content": "Full rule text", "category": "movement|combat|economy|turn_structure|setup|victory", "priority": 1 }
  ],
  "players": [
    {
      "name": "Player Archetype Name",
      "archetype": "label",
      "description": "How this player type plays",
      "victoryCondition": "win condition",
      "specialAbility": "unique ability",
      "playstyle": "Aggressive|Economic|Defensive|Diplomatic|Hybrid",
      "startingResources": {}
    }
  ]
}

Generate at least 5 entities, 8 rules, and 3 player archetypes. Make them specific, interesting, and mechanically coherent. Only return the JSON.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullResponse += event.delta.text;
      res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ done: true, raw: fullResponse })}\n\n`);
  res.end();
});

// Populate DB from AI-generated blueprint
router.post("/projects/:projectId/populate-from-blueprint", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const { blueprint, clearExisting } = req.body;

  if (!blueprint) { res.status(400).json({ error: "Blueprint required" }); return; }

  if (clearExisting) {
    await db.delete(entitiesTable).where(eq(entitiesTable.projectId, projectId));
    await db.delete(rulesTable).where(eq(rulesTable.projectId, projectId));
    await db.delete(playersTable).where(eq(playersTable.projectId, projectId));
  }

  const results = { entities: 0, rules: 0, players: 0 };

  if (blueprint.entities) {
    for (const entityData of blueprint.entities) {
      const [entity] = await db.insert(entitiesTable).values({
        projectId,
        name: entityData.name,
        type: entityData.type || "Item",
        description: entityData.description || null,
      }).returning();

      if (entityData.properties && entity) {
        for (const prop of entityData.properties) {
          await db.insert(propertiesTable).values({
            entityId: entity.id,
            name: prop.name,
            dataType: prop.dataType || "string",
            defaultValue: prop.defaultValue?.toString() || null,
            description: prop.description || null,
          });
        }
      }
      results.entities++;
    }
  }

  if (blueprint.rules) {
    for (let i = 0; i < blueprint.rules.length; i++) {
      const ruleData = blueprint.rules[i];
      await db.insert(rulesTable).values({
        projectId,
        title: ruleData.title,
        content: ruleData.content,
        category: ruleData.category || "general",
        priority: ruleData.priority ?? i,
      });
      results.rules++;
    }
  }

  if (blueprint.players) {
    for (const playerData of blueprint.players) {
      await db.insert(playersTable).values({
        projectId,
        name: playerData.name,
        archetype: playerData.archetype || null,
        description: playerData.description || null,
        victoryCondition: playerData.victoryCondition || null,
        specialAbility: playerData.specialAbility || null,
        playstyle: playerData.playstyle || null,
        startingResources: playerData.startingResources || {},
      });
      results.players++;
    }
  }

  // Update project description/overview if provided
  if (blueprint.overview) {
    await db.update(projectsTable).set({
      description: blueprint.overview.summary || undefined,
    }).where(eq(projectsTable.id, projectId));
  }

  // Log to change log
  await db.insert(changeLogTable).values({
    projectId,
    entityType: "project",
    action: "ai_populate",
    description: `AI populated ${results.entities} entities, ${results.rules} rules, ${results.players} players from blueprint`,
  });

  res.json(results);
});

// AI: Generate only entities (1-click in ontology)
router.post("/projects/:projectId/ai-generate-entities", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const existing = await db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId));
  const { prompt: userPrompt, count = 5 } = req.body;

  const systemContext = `Game: "${project.name}" | Genre: ${project.genre || "unknown"} | ${project.description || ""}
Existing entities: ${existing.map(e => e.name).join(", ") || "none"}`;

  const aiPrompt = `${systemContext}

${userPrompt ? `Additional context: ${userPrompt}\n` : ""}

Generate ${count} new game entities as JSON array. Each should be:
{
  "name": "Entity Name",
  "type": "Item|Faction|Location|Event",
  "description": "what it is and does",
  "properties": [
    { "name": "propName", "dataType": "number|string|boolean|enum", "defaultValue": "value" }
  ]
}

Make them fit the game theme. Do NOT duplicate existing entities. Only return the JSON array.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 3000,
      messages: [{ role: "user", content: aiPrompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { res.status(500).json({ error: "Could not parse AI response" }); return; }
    res.json(JSON.parse(jsonMatch[0]));
  } catch {
    res.status(500).json({ error: "AI generation failed" });
  }
});

// AI: Generate only rules (1-click in rules)
router.post("/projects/:projectId/ai-generate-rules", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const entities = await db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId));
  const existing = await db.select().from(rulesTable).where(eq(rulesTable.projectId, projectId));
  const { category, count = 5 } = req.body;

  const prompt = `Game: "${project.name}" | Genre: ${project.genre || "unknown"}
Entities: ${entities.map(e => `${e.name}[${e.type}]`).join(", ") || "none"}
Existing rules: ${existing.map(r => r.title).join(", ") || "none"}

Generate ${count} new ${category ? `"${category}"` : ""} rules as JSON array:
{
  "title": "Rule Title",
  "content": "Full clear rule text",
  "category": "movement|combat|economy|turn_structure|setup|victory",
  "priority": 1
}

Rules should reference the actual entities. Do NOT duplicate existing rules. Only return the JSON array.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { res.status(500).json({ error: "Could not parse AI response" }); return; }
    res.json(JSON.parse(jsonMatch[0]));
  } catch {
    res.status(500).json({ error: "AI generation failed" });
  }
});

// Change log
router.get("/projects/:projectId/change-log", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const log = await db.select().from(changeLogTable)
    .where(eq(changeLogTable.projectId, projectId))
    .orderBy(changeLogTable.createdAt)
    .limit(50);
  res.json(log.reverse());
});

export default router;
