import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import multer from "multer";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const pdfParse = _require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
import { db, projectFilesTable, projectsTable, entitiesTable, propertiesTable, rulesTable, playersTable, changeLogTable } from "@workspace/db";
import { callAI, streamAI, getUserAIConfig } from "../lib/ai-provider";
import { sql } from "drizzle-orm";

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

  const userId = (req as any).auth?.userId as string | undefined;
  const aiConfig = await getUserAIConfig(userId);

  try {
    const fullResponse = await streamAI(aiConfig, [{ role: "user", content: prompt }], (text) => {
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    }, { maxTokens: 8192 });
    res.write(`data: ${JSON.stringify({ done: true, raw: fullResponse })}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: String(e) })}\n\n`);
    res.end();
  }
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

  if (blueprint.overview) {
    await db.update(projectsTable).set({
      description: blueprint.overview.summary || undefined,
    }).where(eq(projectsTable.id, projectId));
  }

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

  const userId = (req as any).auth?.userId as string | undefined;
  const aiConfig = await getUserAIConfig(userId);

  try {
    const text = await callAI(aiConfig, [{ role: "user", content: aiPrompt }], { maxTokens: 3000 });
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

  const userId = (req as any).auth?.userId as string | undefined;
  const aiConfig = await getUserAIConfig(userId);

  try {
    const text = await callAI(aiConfig, [{ role: "user", content: prompt }], { maxTokens: 3000 });
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { res.status(500).json({ error: "Could not parse AI response" }); return; }
    res.json(JSON.parse(jsonMatch[0]));
  } catch {
    res.status(500).json({ error: "AI generation failed" });
  }
});

// AI: Enhance a single entity — improves description and suggests new properties
router.post("/projects/:projectId/entities/:entityId/ai-enhance", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const entityId = parseInt(req.params.entityId, 10);
  if (isNaN(projectId) || isNaN(entityId)) { res.status(400).json({ error: "Invalid IDs" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId));
  if (!entity) { res.status(404).json({ error: "Entity not found" }); return; }

  const existingProps = await db.select().from(propertiesTable).where(eq(propertiesTable.entityId, entityId));
  const allEntities = await db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId));

  const prompt = `You are a board game design expert helping to enhance a game entity.

Game: "${project.name}" | Genre: ${project.genre || "strategy"} | Description: ${project.description || "a board game"}
Entity: "${entity.name}" | Type: ${entity.type}
Current description: ${entity.description || "(none yet)"}
Existing properties: ${existingProps.map(p => `${p.name} (${p.dataType})`).join(", ") || "none"}
Other entities in game: ${allEntities.filter(e => e.id !== entityId).map(e => `${e.name}[${e.type}]`).join(", ") || "none"}

Return a JSON object with:
{
  "description": "A vivid, specific 2-3 sentence description of this entity that captures its role in the game, its relationship to other entities, and what makes it interesting from a game design perspective.",
  "lore": "1-2 sentences of optional in-world lore/flavor text that gives the entity character.",
  "designNotes": "Brief note on its mechanical role and balance considerations (1-2 sentences).",
  "suggestedProperties": [
    {
      "name": "property_name",
      "dataType": "number|string|boolean|enum",
      "defaultValue": "sensible default",
      "reason": "Why this property matters for game design"
    }
  ]
}

Suggest 2-5 properties that are NOT already defined. Make them mechanically meaningful for a ${entity.type} in a ${project.genre || "board"} game. Only return the JSON object.`;

  const userId = (req as any).auth?.userId as string | undefined;
  const aiConfig = await getUserAIConfig(userId);

  try {
    const text = await callAI(aiConfig, [{ role: "user", content: prompt }], { maxTokens: 1500 });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { res.status(500).json({ error: "Could not parse AI response" }); return; }
    res.json(JSON.parse(jsonMatch[0]));
  } catch {
    res.status(500).json({ error: "AI enhance failed" });
  }
});

// AI: Update entity description
router.patch("/projects/:projectId/entities/:entityId", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const entityId = parseInt(req.params.entityId, 10);
  if (isNaN(projectId) || isNaN(entityId)) { res.status(400).json({ error: "Invalid IDs" }); return; }
  const { description } = req.body;
  const [updated] = await db.update(entitiesTable)
    .set({ description })
    .where(eq(entitiesTable.id, entityId))
    .returning();
  res.json(updated);
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

// NotebookLM source document
router.get("/projects/:projectId/notebooklm", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).send("Invalid project ID"); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).send("Project not found"); return; }

  const [entities, rules, players] = await Promise.all([
    db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId)).orderBy(asc(entitiesTable.type)),
    db.select().from(rulesTable).where(eq(rulesTable.projectId, projectId)).orderBy(asc(rulesTable.category)),
    db.select().from(playersTable).where(eq(playersTable.projectId, projectId)),
  ]);

  const allEntityIds = entities.map(e => e.id);
  const allProperties = allEntityIds.length > 0
    ? await db.select().from(propertiesTable).where(sql`${propertiesTable.entityId} = ANY(${sql`ARRAY[${sql.join(allEntityIds.map(id => sql`${id}`), sql`, `)}]::integer[]`})`)
    : [];

  const propsByEntity = new Map<number, typeof allProperties>();
  for (const p of allProperties) {
    if (!propsByEntity.has(p.entityId)) propsByEntity.set(p.entityId, []);
    propsByEntity.get(p.entityId)!.push(p);
  }

  const entityGroups = ["Item", "Faction", "Location", "Event"] as const;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${project.name} — Game Design Document</title>
  <style>
    body { font-family: Georgia, serif; max-width: 900px; margin: 40px auto; padding: 0 24px; line-height: 1.7; color: #1a1a1a; }
    h1 { font-size: 2.2em; border-bottom: 3px solid #333; padding-bottom: 12px; }
    h2 { font-size: 1.5em; margin-top: 2em; color: #222; border-bottom: 1px solid #ccc; padding-bottom: 6px; }
    h3 { font-size: 1.1em; margin-top: 1.5em; color: #333; }
    .meta { color: #555; font-size: 0.95em; margin-bottom: 2em; }
    .entity { margin: 1em 0; padding: 12px 16px; background: #f9f9f9; border-left: 4px solid #666; border-radius: 2px; }
    .entity-type { font-size: 0.8em; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: bold; }
    .props { margin-top: 6px; font-size: 0.9em; color: #555; }
    .rule { margin: 1em 0; padding: 10px 16px; background: #f5f5f5; border-left: 3px solid #999; }
    .category { font-size: 0.8em; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: bold; }
    .player { margin: 1em 0; padding: 12px 16px; background: #f5f5f5; border-left: 4px solid #555; }
    .playstyle { font-size: 0.85em; color: #666; font-style: italic; }
    footer { margin-top: 3em; padding-top: 1em; border-top: 1px solid #ddd; font-size: 0.85em; color: #888; }
  </style>
</head>
<body>
<h1>${project.name}</h1>
<div class="meta">
  <strong>Genre:</strong> ${project.genre || "Unspecified"} &nbsp;|&nbsp;
  <strong>Entities:</strong> ${entities.length} &nbsp;|&nbsp;
  <strong>Rules:</strong> ${rules.length} &nbsp;|&nbsp;
  <strong>Player Archetypes:</strong> ${players.length}
</div>

${project.description ? `<p>${project.description}</p>` : ""}

<h2>Game Entities (Ontology)</h2>
${entityGroups.map(type => {
  const group = entities.filter(e => e.type === type);
  if (!group.length) return "";
  return `<h3>${type}s (${group.length})</h3>
${group.map(e => {
  const props = propsByEntity.get(e.id) ?? [];
  return `<div class="entity">
  <div class="entity-type">${e.type}</div>
  <strong>${e.name}</strong>
  ${e.description ? `<p>${e.description}</p>` : ""}
  ${props.length ? `<div class="props"><strong>Properties:</strong> ${props.map(p => `${p.name} (${p.dataType}${p.defaultValue ? `, default: ${p.defaultValue}` : ""})`).join(", ")}</div>` : ""}
</div>`;
}).join("\n")}`;
}).join("\n")}

${entities.length === 0 ? "<p><em>No entities defined yet.</em></p>" : ""}

<h2>Game Rules</h2>
${(() => {
  if (!rules.length) return "<p><em>No rules defined yet.</em></p>";
  const categories = [...new Set(rules.map(r => r.category))].sort();
  return categories.map(cat => `<h3>${cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " ")} Rules</h3>
${rules.filter(r => r.category === cat).map(r => `<div class="rule">
  <div class="category">${r.category} &nbsp; Priority: ${r.priority ?? 1}</div>
  <strong>${r.title}</strong>
  <p>${r.content}</p>
</div>`).join("\n")}`).join("\n");
})()}

${players.length > 0 ? `<h2>Player Archetypes</h2>
${players.map((p: { name: string; playstyle?: string | null; description?: string | null; specialAbilities?: unknown; startingResources?: unknown }) => `<div class="player">
  <strong>${p.name}</strong>
  ${p.playstyle ? `<div class="playstyle">Playstyle: ${p.playstyle}</div>` : ""}
  ${p.description ? `<p>${p.description}</p>` : ""}
  ${p.specialAbilities ? `<p><strong>Special Abilities:</strong> ${JSON.stringify(p.specialAbilities)}</p>` : ""}
  ${p.startingResources ? `<p><strong>Starting Resources:</strong> ${JSON.stringify(p.startingResources)}</p>` : ""}
</div>`).join("\n")}` : ""}

<footer>
  Generated by AI Board Game Factory &nbsp;|&nbsp; ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
</footer>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(html);
});

export default router;
