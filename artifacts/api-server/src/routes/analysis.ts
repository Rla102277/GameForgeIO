import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import {
  db, projectsTable, entitiesTable, propertiesTable, rulesTable,
  playersTable, changeLogTable, playtestFeedbackTable,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

// ── Balance Analysis ─────────────────────────────────────────────────────────
router.get("/projects/:projectId/balance-analysis", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const entities = await db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId));
  const allProps = await db.select().from(propertiesTable)
    .where(eq(propertiesTable.projectId, projectId));

  // Group properties by entity
  const entityMap = entities.map(e => ({
    ...e,
    properties: allProps.filter(p => p.entityId === e.id),
  }));

  // Find numeric properties and compute stats per property name
  const numericStatsByProp: Record<string, { entityName: string; type: string; value: number }[]> = {};
  for (const entity of entityMap) {
    for (const prop of entity.properties) {
      const val = parseFloat(prop.defaultValue ?? "");
      if (!isNaN(val)) {
        if (!numericStatsByProp[prop.name]) numericStatsByProp[prop.name] = [];
        numericStatsByProp[prop.name].push({ entityName: entity.name, type: entity.type ?? "Item", value: val });
      }
    }
  }

  // Compute min/max/avg/stddev per property
  const stats = Object.entries(numericStatsByProp).map(([propName, entries]) => {
    const vals = entries.map(e => e.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const stddev = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length);
    const outliers = entries.filter(e => Math.abs(e.value - avg) > 2 * stddev);
    return { propName, entries, min, max, avg: Math.round(avg * 100) / 100, stddev: Math.round(stddev * 100) / 100, outliers };
  });

  // Overall balance score (lower stddev relative to range = better balance)
  const balanceScore = stats.length === 0 ? null : Math.round(
    100 - (stats.reduce((acc, s) => acc + (s.max - s.min === 0 ? 0 : s.stddev / (s.max - s.min)), 0) / stats.length) * 100
  );

  res.json({ entities: entityMap, stats, balanceScore });
});

// ── Complexity Score ──────────────────────────────────────────────────────────
router.get("/projects/:projectId/complexity-score", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [entities, rules, players] = await Promise.all([
    db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId)),
    db.select().from(rulesTable).where(eq(rulesTable.projectId, projectId)),
    db.select().from(playersTable).where(eq(playersTable.projectId, projectId)),
  ]);

  const ruleCategories = new Set(rules.map(r => r.category)).size;
  const avgRuleLength = rules.length ? rules.reduce((a, r) => a + r.content.length, 0) / rules.length : 0;

  // Weighted sub-scores (each 0-25)
  const entityScore = Math.round(Math.min(entities.length / 20 * 25, 25));
  const rulesScore = Math.round(Math.min(rules.length / 30 * 25, 25));
  const playersScore = Math.round(Math.min(players.length / 6 * 25, 25));
  const economyScore = Math.round(Math.min((ruleCategories / 8 * 12.5) + (avgRuleLength / 500 * 12.5), 25));

  const total = Math.min(Math.round((entityScore + rulesScore + playersScore + economyScore) / 4 * 4), 100);

  const label = total < 20 ? "Light" : total < 40 ? "Light-Medium" : total < 60 ? "Medium" : total < 80 ? "Medium-Heavy" : "Heavy";

  const suggestions: string[] = [];
  if (entities.length < 5) suggestions.push("Add more entities to increase structural depth.");
  if (rules.length < 5) suggestions.push("More rules will give the game more complexity.");
  if (players.length < 2) suggestions.push("Define player archetypes for asymmetric complexity.");
  if (ruleCategories < 3) suggestions.push("Diversify rule categories for richer gameplay.");

  res.json({
    overall: total,
    label,
    breakdown: { entities: entityScore, rules: rulesScore, players: playersScore, economy: economyScore },
    suggestion: suggestions[0] ?? null,
  });
});

// ── Rule Conflict Checker ─────────────────────────────────────────────────────
router.post("/projects/:projectId/rules/check-conflicts", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [project, rules] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).then(r => r[0]),
    db.select().from(rulesTable).where(eq(rulesTable.projectId, projectId)).orderBy(asc(rulesTable.category)),
  ]);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (rules.length < 2) { res.json({ conflicts: [], summary: "Not enough rules to check. Add more rules first." }); return; }

  const rulesText = rules.map((r, i) => `[${i + 1}] (${r.category}) ${r.title}: ${r.content}`).join("\n");

  const prompt = `You are a board game rules editor for "${project.name}". Analyze these rules for conflicts, ambiguities, and logical inconsistencies.

Rules:
${rulesText}

Find all issues and return JSON:
{
  "conflicts": [
    {
      "severity": "critical|warning|suggestion",
      "ruleIds": [1, 3],
      "title": "Short conflict title",
      "description": "What the conflict is and why it's a problem",
      "resolution": "How to fix it"
    }
  ],
  "summary": "2-3 sentence overall assessment of rule quality"
}

Only return the JSON. Look for: direct contradictions, ambiguous timing, missing edge cases, undefined terms, circular dependencies.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    res.json(JSON.parse(clean));
  } catch {
    res.status(500).json({ error: "Conflict check failed" });
  }
});

// ── Press Kit Generator (SSE) ─────────────────────────────────────────────────
router.post("/projects/:projectId/press-kit/generate", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [project, entities, rules, players] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).then(r => r[0]),
    db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId)),
    db.select().from(rulesTable).where(eq(rulesTable.projectId, projectId)),
    db.select().from(playersTable).where(eq(playersTable.projectId, projectId)),
  ]);
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (d: object) => res.write(`data: ${JSON.stringify(d)}\n\n`);

  const prompt = `Write a professional press kit for the board game "${project.name}".

Game info: Genre: ${project.genre || "Strategy"} | ${project.description || ""} | ${entities.length} entities | ${rules.length} rules | ${players.length} player archetypes | Players: ${project.playerCount || "2-4"}

Generate JSON:
{
  "boxCopy": "Punchy back-of-box description (100-150 words). Sell the fantasy, mention player count and time.",
  "bggDescription": "BoardGameGeek-style description (200-250 words). Mechanics-focused, accurate, engaging.",
  "pressRelease": "Full press release (400-500 words) with headline, dateline, 4-5 paragraphs, designer quote, game specs table, and boilerplate.",
  "socialPosts": {
    "twitter": "280-char tweet with hashtags",
    "instagram": "Instagram caption with emojis and hashtags (150 words)",
    "reddit": "r/boardgames post title + body (200 words)"
  },
  "reviewerPitch": "3-paragraph pitch email to board game reviewers/YouTubers",
  "keyFeatures": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
  "specs": { "players": "X-Y", "time": "X-Y min", "age": "X+", "complexity": "X/5", "price": "$XX MSRP" }
}

Use actual game details throughout. Return ONLY the JSON.`;

  try {
    let fullText = "";
    const stream = await anthropic.messages.stream({ model: "claude-sonnet-4-5", max_tokens: 3000, messages: [{ role: "user", content: prompt }] });
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        fullText += chunk.delta.text;
        send({ content: chunk.delta.text });
      }
    }
    try {
      const clean = fullText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      send({ done: true, pressKit: JSON.parse(clean) });
    } catch { send({ done: true, raw: fullText }); }
    res.end();
  } catch (e) { send({ error: String(e) }); res.end(); }
});

// ── Publisher Sell Sheet (SSE) ────────────────────────────────────────────────
router.post("/projects/:projectId/publisher-pitch/generate", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [project, entities, rules, players] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).then(r => r[0]),
    db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId)),
    db.select().from(rulesTable).where(eq(rulesTable.projectId, projectId)),
    db.select().from(playersTable).where(eq(playersTable.projectId, projectId)),
  ]);
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (d: object) => res.write(`data: ${JSON.stringify(d)}\n\n`);

  const prompt = `Write a publisher sell sheet (one-pager) for board game "${project.name}" targeting acquisition editors at mid-tier to large publishers.

Game: ${project.genre || "Strategy"} | ${project.description || ""} | ${entities.length} components | ${rules.length} rules | ${players.length} player archetypes | ${project.playerCount || "2-4"} players

JSON output:
{
  "headline": "Bold 1-line hook for publishers",
  "hook": "2-3 sentences about market opportunity and why now",
  "gameInOneSentence": "The core concept in under 20 words",
  "mechanicPillars": ["Pillar 1", "Pillar 2", "Pillar 3"],
  "targetAudience": "Who buys this and why",
  "marketComparisons": "X meets Y but with Z — reference 2-3 published games for positioning",
  "whyItWorks": "3-4 bullet points explaining the design's strength",
  "designerStatement": "60-word first-person statement from the designer about the vision",
  "productionNotes": "Estimated component count, manufacturing tier, MSRP range",
  "timeline": "Prototype status, revision stage, timeline to publication-ready",
  "contactBlock": "Template contact info block for the sell sheet footer"
}

Return ONLY the JSON.`;

  try {
    let fullText = "";
    const stream = await anthropic.messages.stream({ model: "claude-haiku-4-5", max_tokens: 1500, messages: [{ role: "user", content: prompt }] });
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        fullText += chunk.delta.text;
        send({ content: chunk.delta.text });
      }
    }
    try {
      const clean = fullText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      send({ done: true, pitch: JSON.parse(clean) });
    } catch { send({ done: true, raw: fullText }); }
    res.end();
  } catch (e) { send({ error: String(e) }); res.end(); }
});

// ── Publisher Sell Sheet Print ────────────────────────────────────────────────
router.get("/projects/:projectId/publisher-pitch-print", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const pitchParam = req.query.pitch as string | undefined;
  if (!pitchParam) { res.status(400).send("No pitch data"); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).send("Not found"); return; }

  let p: Record<string, unknown>;
  try { p = JSON.parse(decodeURIComponent(pitchParam)); } catch { res.status(400).send("Invalid pitch data"); return; }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${project.name} — Publisher Sell Sheet</title>
<style>
*{box-sizing:border-box;margin:0;padding:0} body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;background:#fff;font-size:11pt}
.page{max-width:720px;margin:0 auto;padding:32px 40px}
.header{background:#111;color:#fff;padding:28px 32px;margin:-32px -40px 28px;display:flex;justify-content:space-between;align-items:center}
h1{font-size:1.8em;letter-spacing:-0.5px} .badge{background:#e63946;color:#fff;padding:4px 12px;border-radius:3px;font-size:0.7em;text-transform:uppercase;letter-spacing:1px;font-weight:bold}
.tagline{font-size:1.15em;color:#555;font-style:italic;margin-bottom:20px;border-left:4px solid #e63946;padding-left:14px}
.one-liner{font-size:1.05em;font-weight:bold;margin-bottom:18px;color:#111}
h2{font-size:0.75em;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:18px 0 6px;font-family:sans-serif}
p{font-size:0.9em;line-height:1.7;color:#333;margin-bottom:10px}
.pillars{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.pillar{background:#f0f0f0;padding:4px 12px;border-radius:20px;font-size:0.8em;font-weight:600}
ul{padding-left:18px;font-size:0.9em;line-height:1.8;color:#333}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:14px 0}
.box{border:1px solid #ddd;border-radius:4px;padding:14px}
.box-title{font-size:0.7em;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px;font-weight:bold}
.footer{margin-top:24px;padding-top:14px;border-top:1px solid #ddd;font-size:0.75em;color:#888;text-align:center}
.print-btn{position:fixed;top:16px;right:16px;background:#e63946;color:#fff;border:none;padding:8px 18px;cursor:pointer;font-size:0.85em;border-radius:3px;font-family:sans-serif;font-weight:bold}
@media print{.print-btn{display:none}}
</style></head><body>
<button class="print-btn" onclick="window.print()">Save as PDF</button>
<div class="page">
<div class="header"><div><h1>${project.name}</h1><div style="color:#aaa;font-size:0.85em;margin-top:4px">${project.genre || "Board Game"} · ${project.playerCount || "2-4"} Players</div></div><div class="badge">Publisher Sell Sheet</div></div>
${p.headline ? `<div style="font-size:1.2em;font-weight:bold;margin-bottom:12px">${p.headline}</div>` : ""}
${p.gameInOneSentence ? `<div class="tagline">${p.gameInOneSentence}</div>` : ""}
${p.hook ? `<p>${p.hook}</p>` : ""}
${p.mechanicPillars && Array.isArray(p.mechanicPillars) ? `<h2>Core Mechanics</h2><div class="pillars">${(p.mechanicPillars as string[]).map(m => `<span class="pillar">${m}</span>`).join("")}</div>` : ""}
<div class="grid2">
${p.targetAudience ? `<div class="box"><div class="box-title">Target Audience</div><p>${p.targetAudience}</p></div>` : ""}
${p.marketComparisons ? `<div class="box"><div class="box-title">Market Position</div><p>${p.marketComparisons}</p></div>` : ""}
</div>
${p.whyItWorks && Array.isArray(p.whyItWorks) ? `<h2>Why It Works</h2><ul>${(p.whyItWorks as string[]).map((b: string) => `<li>${b}</li>`).join("")}</ul>` : ""}
${p.designerStatement ? `<h2>Designer Statement</h2><p style="font-style:italic">"${p.designerStatement}"</p>` : ""}
<div class="grid2">
${p.productionNotes ? `<div class="box"><div class="box-title">Production</div><p>${p.productionNotes}</p></div>` : ""}
${p.timeline ? `<div class="box"><div class="box-title">Timeline</div><p>${p.timeline}</p></div>` : ""}
</div>
<div class="footer">${p.contactBlock || `${project.name} · AI Board Game Factory · ${new Date().getFullYear()}`}</div>
</div></body></html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// ── AI Playthrough Simulation (SSE) ──────────────────────────────────────────
router.post("/projects/:projectId/simulate-playthrough", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { turns = 5 } = req.body as { turns?: number };

  const [project, entities, rules, players] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).then(r => r[0]),
    db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId)),
    db.select().from(rulesTable).where(eq(rulesTable.projectId, projectId)).orderBy(asc(rulesTable.priority)),
    db.select().from(playersTable).where(eq(playersTable.projectId, projectId)),
  ]);
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (d: object) => res.write(`data: ${JSON.stringify(d)}\n\n`);

  const archetypes = players.length > 0 ? players.map(p => p.name) : ["Player A", "Player B"];
  const rulesText = rules.slice(0, 15).map(r => `- ${r.title}: ${r.content.slice(0, 100)}`).join("\n");
  const entitiesText = entities.slice(0, 12).map(e => `- ${e.name} [${e.type}]`).join("\n");

  const prompt = `You are simulating a complete playthrough of "${project.name}" (${project.genre || "strategy"} game).

Players: ${archetypes.join(", ")}
Simulate ${Math.min(turns, 8)} turns.

Game entities: ${entitiesText || "None defined yet"}
Key rules: ${rulesText || "None defined yet"}
${project.description ? `Game: ${project.description}` : ""}

Write a vivid, detailed turn-by-turn playthrough. For each turn:
- State whose turn it is (bold with **Name**)
- Describe what they do, what decisions they face, what entities they use
- Show consequences of their actions
- Track a simple running score or resource count in brackets [Score: P1:3 P2:2]
- Include at least one "interesting moment" per 2 turns (a surprise, a close call, a clever play)

After the final turn, write:
**--- GAME END ---**
Winner: [name and why]
**Post-game analysis:** What worked, what felt unbalanced, what was fun`;

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-5", max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta")
        send({ content: chunk.delta.text });
    }
    send({ done: true });
    res.end();
  } catch (e) { send({ error: String(e) }); res.end(); }
});

// ── Changelog ─────────────────────────────────────────────────────────────────
router.get("/projects/:projectId/changelog", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const entries = await db.select().from(changeLogTable)
    .where(eq(changeLogTable.projectId, projectId))
    .orderBy(desc(changeLogTable.createdAt))
    .limit(100);
  res.json(entries);
});

// ── Playtest Feedback ─────────────────────────────────────────────────────────
router.get("/projects/:projectId/playtest-feedback", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const feedback = await db.select().from(playtestFeedbackTable)
    .where(eq(playtestFeedbackTable.projectId, projectId))
    .orderBy(desc(playtestFeedbackTable.createdAt));
  res.json(feedback);
});

router.post("/projects/:projectId/playtest-feedback", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { testerName, sessionCode, overallRating, funRating, balanceRating, clarityRating,
    whatWorked, whatDidnt, suggestions, wouldPlay } = req.body;
  const [entry] = await db.insert(playtestFeedbackTable).values({
    projectId, testerName, sessionCode, overallRating, funRating, balanceRating,
    clarityRating, whatWorked, whatDidnt, suggestions, wouldPlay,
  }).returning();
  res.json(entry);
});

export default router;
