import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { db, researchItemsTable, projectsTable, entitiesTable, rulesTable, playersTable } from "@workspace/db";
import { callAI, streamAI, getUserAIConfig } from "../lib/ai-provider";

const router: IRouter = Router();

// List research items
router.get("/projects/:projectId/research-items", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const items = await db.select().from(researchItemsTable)
    .where(eq(researchItemsTable.projectId, projectId))
    .orderBy(desc(researchItemsTable.createdAt));
  res.json(items);
});

// Create research item (manual text/note)
router.post("/projects/:projectId/research-items", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const { title, content, sourceUrl, type = "text", tags = [] } = req.body;
  if (!title) { res.status(400).json({ error: "Title is required" }); return; }
  const [item] = await db.insert(researchItemsTable).values({ projectId, title, content, sourceUrl, type, tags }).returning();
  res.json(item);
});

// Delete research item
router.delete("/projects/:projectId/research-items/:itemId", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const itemId = parseInt(req.params.itemId, 10);
  if (isNaN(projectId) || isNaN(itemId)) { res.status(400).json({ error: "Invalid IDs" }); return; }
  await db.delete(researchItemsTable).where(eq(researchItemsTable.id, itemId));
  res.json({ success: true });
});

// Fetch a URL and save as research item
router.post("/projects/:projectId/research-items/fetch-url", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const { url } = req.body;
  if (!url) { res.status(400).json({ error: "URL is required" }); return; }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BoardGameFactory/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 20000);

    const hostname = new URL(url).hostname.replace("www.", "");
    const [item] = await db.insert(researchItemsTable).values({
      projectId,
      title: `${hostname} — fetched`,
      content: text,
      sourceUrl: url,
      type: "url",
      tags: [],
    }).returning();
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: `Failed to fetch URL: ${e instanceof Error ? e.message : String(e)}` });
  }
});

// SSE: AI Research Chat — can fetch URLs, do research, save to library
router.post("/projects/:projectId/research/chat", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const { message, history = [] } = req.body as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
  };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const researchItems = await db.select().from(researchItemsTable)
    .where(eq(researchItemsTable.projectId, projectId))
    .orderBy(asc(researchItemsTable.createdAt));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Check if user is asking to fetch a URL
  const urlMatch = message.match(/https?:\/\/[^\s"']+/);
  let fetchedContent = "";
  let fetchedUrl = "";

  if (urlMatch) {
    fetchedUrl = urlMatch[0];
    send({ content: `\n\nFetching ${fetchedUrl}...\n\n` });
    try {
      const urlRes = await fetch(fetchedUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; BoardGameFactory/1.0)" },
        signal: AbortSignal.timeout(12000),
      });
      const html = await urlRes.text();
      fetchedContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 15000);
      send({ content: `Fetched ${fetchedContent.length.toLocaleString()} characters from ${new URL(fetchedUrl).hostname}.\n\n` });
    } catch (e) {
      send({ content: `Warning: Could not fetch ${fetchedUrl}: ${e instanceof Error ? e.message : "Unknown error"}. Continuing without it.\n\n` });
    }
  }

  const existingResearch = researchItems.length > 0
    ? `\n\nExisting research in library:\n${researchItems.map(r => `- [${r.type.toUpperCase()}] "${r.title}" (${(r.content?.length ?? 0).toLocaleString()} chars)${r.sourceUrl ? ` from ${r.sourceUrl}` : ""}`).join("\n")}`
    : "";

  const systemPrompt = `You are a board game research assistant helping to design "${project.name}" (${project.genre || "strategy"} game). ${project.description ? `Game description: ${project.description}` : ""}

Your job is to help the designer find and extract useful information for their game — rulebooks, mechanics references, design patterns, thematic material, competitive analysis, etc.

You can:
- Analyze any content the user provides or that was fetched from a URL
- Extract key game mechanics, rules patterns, entity ideas, and player archetypes
- Summarize rulebooks and game design documents
- Make comparisons between games
- Identify reusable patterns and mechanics
- Suggest research directions
${existingResearch}

When you find valuable content worth saving to the research library, end your message with a JSON block like:
<save_research>
{"title": "Title for this finding", "content": "Extracted/summarized content to save", "type": "ai_note"}
</save_research>

${fetchedContent ? `\n\nFetched content from ${fetchedUrl}:\n---\n${fetchedContent}\n---` : ""}`;

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...history.slice(-8),
    { role: "user", content: message },
  ];

  const userId = (req as any).auth?.userId as string | undefined;
  let aiConfig;
  try {
    aiConfig = await getUserAIConfig(userId);
  } catch (err) {
    console.error("[research-chat] No AI provider configured:", err);
    send({ error: "AI is not configured. Please add an API key in Settings." });
    res.end();
    return;
  }

  try {
    const fullText = await streamAI(aiConfig, messages, (text) => { send({ content: text }); }, { system: systemPrompt, maxTokens: 2000 });

    // Auto-save research if AI suggested it
    const saveMatch = fullText.match(/<save_research>([\s\S]*?)<\/save_research>/);
    let savedItem = null;
    if (saveMatch) {
      try {
        const saveData = JSON.parse(saveMatch[1].trim());
        const [saved] = await db.insert(researchItemsTable).values({
          projectId,
          title: saveData.title || "AI Research Note",
          content: saveData.content || fullText,
          sourceUrl: fetchedUrl || null,
          type: saveData.type || "ai_note",
          tags: [],
        }).returning();
        savedItem = saved;
      } catch { /* ignore parse errors */ }
    }
    // Also auto-save fetched URL content
    if (fetchedUrl && fetchedContent && !saveMatch) {
      try {
        const hostname = new URL(fetchedUrl).hostname.replace("www.", "");
        const [saved] = await db.insert(researchItemsTable).values({
          projectId,
          title: `${hostname} — ${new Date().toLocaleDateString()}`,
          content: fetchedContent,
          sourceUrl: fetchedUrl,
          type: "url",
          tags: [],
        }).returning();
        savedItem = saved;
      } catch { /* ignore */ }
    }

    send({ done: true, savedItem });
    res.end();
  } catch (e) {
    send({ error: `Research chat failed: ${e instanceof Error ? e.message : String(e)}` });
    res.end();
  }
});

// AI: Enhance project description (shorter, longer, rephrase, vivid)
router.post("/projects/:projectId/description/ai-enhance", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const { action = "rephrase", currentDescription } = req.body as { action: string; currentDescription: string };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const instructions: Record<string, string> = {
    shorter: "Rewrite this game description to be more concise — ideally 1-2 sentences. Keep the key concept but cut everything redundant.",
    longer: "Expand this game description to be more detailed and evocative — 3-5 sentences. Add thematic flavor, mention the core conflict or goal, and hint at the main mechanics.",
    rephrase: "Rephrase this game description with fresh, engaging wording. Keep the same meaning and length but vary the sentence structure and vocabulary.",
    vivid: "Rewrite this game description to be more vivid and thematic — use strong verbs, evoke the atmosphere, and make it feel exciting. Keep roughly the same length.",
    formal: "Rewrite this game description in a professional, formal tone suitable for a publisher pitch. Be precise about mechanics and target audience.",
    punchy: "Rewrite this game description as a punchy marketing hook — start with the core fantasy or conflict, make it exciting in under 2 sentences.",
  };

  const instruction = instructions[action] ?? instructions.rephrase;
  const current = currentDescription || project.description || "A strategic board game.";

  const prompt = `Game: "${project.name}" | Genre: ${project.genre || "strategy"}

Current description: "${current}"

${instruction}

Return ONLY the new description text, nothing else. No quotes, no preamble.`;

  const userId = (req as any).auth?.userId as string | undefined;
  let aiConfig;
  try {
    aiConfig = await getUserAIConfig(userId);
  } catch (err) {
    console.error("[description/ai-enhance] No AI provider configured:", err);
    res.status(503).json({ error: "AI is not configured. Please add an API key in Settings." });
    return;
  }

  try {
    const text = await callAI(aiConfig, [{ role: "user", content: prompt }], { maxTokens: 300 });
    res.json({ description: text.trim() });
  } catch (err) {
    console.error("[description/ai-enhance] AI call failed:", err);
    res.status(500).json({ error: "AI enhance failed. Please try again or check your API key in Settings." });
  }
});

// Generate rulebook HTML (print-to-PDF ready)
router.get("/projects/:projectId/rulebook-print", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).send("Invalid project ID"); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).send("Project not found"); return; }

  const [entities, rules, players] = await Promise.all([
    db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId)).orderBy(asc(entitiesTable.type)),
    db.select().from(rulesTable).where(eq(rulesTable.projectId, projectId)).orderBy(asc(rulesTable.category), asc(rulesTable.priority)),
    db.select().from(playersTable).where(eq(playersTable.projectId, projectId)),
  ]);

  const categories = [...new Set(rules.map(r => r.category))].sort();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${project.name} — Official Rulebook</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a1a1a; background: white; }
    .page { max-width: 700px; margin: 0 auto; padding: 40px 48px; }
    h1 { font-size: 2.4em; border-bottom: 4px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 8px; letter-spacing: -0.5px; }
    .subtitle { font-size: 1.1em; color: #555; margin-bottom: 28px; }
    h2 { font-size: 1.5em; margin: 32px 0 10px; border-bottom: 2px solid #ccc; padding-bottom: 6px; color: #1a1a1a; page-break-after: avoid; }
    h3 { font-size: 1.1em; margin: 20px 0 6px; color: #333; page-break-after: avoid; }
    p { font-size: 0.95em; line-height: 1.75; color: #333; margin-bottom: 10px; }
    .meta { display: flex; gap: 24px; font-size: 0.9em; color: #555; margin-bottom: 28px; border: 1px solid #ddd; border-radius: 6px; padding: 14px 18px; background: #f9f9f9; }
    .meta-item strong { display: block; font-size: 0.75em; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 2px; }
    .rule-block { margin: 12px 0; padding: 12px 16px; border-left: 4px solid #bbb; background: #f7f7f7; page-break-inside: avoid; }
    .rule-title { font-weight: bold; margin-bottom: 4px; font-size: 1em; }
    .rule-cat { font-size: 0.7em; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: bold; float: right; margin-top: 2px; }
    .rule-priority { font-size: 0.7em; color: #bbb; margin-left: 8px; }
    .entity-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 8px 0; }
    .entity-card { border: 1px solid #ddd; padding: 10px 14px; border-radius: 4px; page-break-inside: avoid; }
    .entity-type { font-size: 0.7em; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: bold; margin-bottom: 4px; }
    .entity-name { font-weight: bold; margin-bottom: 4px; }
    .entity-desc { font-size: 0.85em; color: #555; line-height: 1.5; }
    .player-block { margin: 12px 0; padding: 14px 18px; border: 1px solid #ddd; border-radius: 4px; page-break-inside: avoid; }
    .player-name { font-size: 1.15em; font-weight: bold; margin-bottom: 4px; }
    .player-tag { font-size: 0.8em; color: #666; font-style: italic; margin-bottom: 6px; }
    .toc { margin: 24px 0; padding: 16px 20px; background: #f7f7f7; border: 1px solid #ddd; border-radius: 4px; }
    .toc h3 { margin: 0 0 10px; font-size: 1em; text-transform: uppercase; letter-spacing: 1px; color: #555; }
    .toc ol { padding-left: 20px; font-size: 0.9em; line-height: 1.8; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 0.8em; color: #aaa; text-align: center; }
    @media print {
      body { font-size: 11pt; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      a { color: inherit; text-decoration: none; }
    }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #1a1a1a; color: white; border: none; padding: 10px 20px; cursor: pointer; font-size: 0.9em; border-radius: 4px; font-family: sans-serif; z-index: 9999; }
    .print-btn:hover { background: #333; }
  </style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
<div class="page">

<h1>${project.name}</h1>
<p class="subtitle">${project.genre ? `${project.genre} Board Game` : "Board Game"} Rulebook</p>

<div class="meta">
  ${project.genre ? `<div class="meta-item"><strong>Genre</strong>${project.genre}</div>` : ""}
  ${entities.length ? `<div class="meta-item"><strong>Entities</strong>${entities.length} defined</div>` : ""}
  ${rules.length ? `<div class="meta-item"><strong>Rules</strong>${rules.length} rules</div>` : ""}
  ${players.length ? `<div class="meta-item"><strong>Player Types</strong>${players.length} archetypes</div>` : ""}
</div>

${project.description ? `<p style="font-size:1.05em; line-height:1.8; margin-bottom:24px; color:#222;">${project.description}</p>` : ""}

<div class="toc">
  <h3>Contents</h3>
  <ol>
    ${entities.length ? "<li>Game Entities &amp; Components</li>" : ""}
    ${rules.length ? "<li>Rules &amp; Mechanics</li>" : ""}
    ${players.length ? "<li>Player Archetypes</li>" : ""}
    <li>Credits</li>
  </ol>
</div>

${entities.length > 0 ? `
<h2>1. Game Entities &amp; Components</h2>
<p>The following entities make up the physical and conceptual components of ${project.name}.</p>
${["Item", "Faction", "Location", "Event"].map(type => {
  const group = entities.filter(e => e.type === type);
  if (!group.length) return "";
  return `<h3>${type}s</h3><div class="entity-grid">${group.map(e => `
<div class="entity-card">
  <div class="entity-type">${e.type}</div>
  <div class="entity-name">${e.name}</div>
  ${e.description ? `<div class="entity-desc">${e.description}</div>` : ""}
</div>`).join("")}</div>`;
}).join("")}` : ""}

${rules.length > 0 ? `
<h2 class="${entities.length ? "page-break" : ""}">2. Rules &amp; Mechanics</h2>
<p>All rules are organized by category and listed in priority order.</p>
${categories.map(cat => `
<h3>${cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " ")}</h3>
${rules.filter(r => r.category === cat).map(r => `
<div class="rule-block">
  <div><span class="rule-title">${r.title}</span><span class="rule-cat">${r.category}</span><span class="rule-priority">P${r.priority ?? 1}</span></div>
  <p>${r.content}</p>
</div>`).join("")}`).join("")}` : ""}

${players.length > 0 ? `
<h2>3. Player Archetypes</h2>
<p>Each player archetype has a unique playstyle and strategic focus.</p>
${players.map((p: { name: string; playstyle?: string | null; description?: string | null; specialAbilities?: unknown; startingResources?: unknown }) => `
<div class="player-block">
  <div class="player-name">${p.name}</div>
  ${p.playstyle ? `<div class="player-tag">Playstyle: ${p.playstyle}</div>` : ""}
  ${p.description ? `<p>${p.description}</p>` : ""}
</div>`).join("")}` : ""}

<div class="footer">
  ${project.name} Rulebook &nbsp;·&nbsp; Generated by AI Board Game Factory &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" })}
</div>
</div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// Update analyze-and-build to include research items
router.post("/projects/:projectId/analyze-and-build-with-research", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const researchItems = await db.select().from(researchItemsTable)
    .where(eq(researchItemsTable.projectId, projectId))
    .orderBy(asc(researchItemsTable.createdAt));

  if (!researchItems.length) {
    res.status(400).json({ error: "No research items found. Add some research first." });
    return;
  }

  const researchContent = researchItems
    .filter(r => r.content)
    .map(r => `=== ${r.title} ${r.sourceUrl ? `(${r.sourceUrl})` : ""} ===\n${r.content?.slice(0, 5000)}`)
    .join("\n\n---\n\n")
    .slice(0, 40000);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const prompt = `You are an expert board game designer. Based on the following research materials, design a complete board game called "${project.name}" (${project.genre || "strategy"} genre).

Research Materials:
${researchContent}

Project context: ${project.description || ""}

Generate a complete, detailed JSON blueprint:
{
  "overview": {
    "summary": "2-3 sentence description of the final game design",
    "theme": "thematic setting",
    "mechanics": ["mechanic1", "mechanic2", "mechanic3"],
    "playerCount": "2-4 players",
    "duration": "60-90 minutes",
    "complexity": "Medium"
  },
  "entities": [
    {
      "name": "Entity Name",
      "type": "Item|Faction|Location|Event",
      "description": "what it is and does",
      "properties": [{ "name": "prop", "dataType": "number", "defaultValue": "0", "description": "what it does" }]
    }
  ],
  "rules": [
    {
      "title": "Rule Title",
      "content": "Complete rule text",
      "category": "movement|combat|economy|turn_structure|setup|victory",
      "priority": 1
    }
  ],
  "players": [
    {
      "name": "Archetype Name",
      "archetype": "one-word archetype",
      "description": "How this player type plays",
      "victoryCondition": "How they win",
      "specialAbility": "Unique power",
      "playstyle": "aggressive|economic|diplomatic|control",
      "startingResources": { "gold": 5 }
    }
  ]
}

Generate at minimum: 8 entities, 12 rules, 3 player archetypes. Draw directly from the research materials.`;

  const userId = (req as any).auth?.userId as string | undefined;
  let aiConfig;
  try {
    aiConfig = await getUserAIConfig(userId);
  } catch (err) {
    console.error("[research/build-blueprint] No AI provider configured:", err);
    send({ error: "AI is not configured. Please add an API key in Settings." });
    res.end();
    return;
  }

  try {
    const fullText = await streamAI(aiConfig, [{ role: "user", content: prompt }], (text) => {
      send({ content: text });
    }, { maxTokens: 6000 });
    send({ done: true, raw: fullText });
    res.end();
  } catch (e) {
    console.error("[research/build-blueprint] AI stream failed:", e);
    send({ error: String(e) });
    res.end();
  }
});

export default router;
