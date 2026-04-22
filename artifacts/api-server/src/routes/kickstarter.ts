import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, projectsTable, entitiesTable, rulesTable, playersTable, assetsTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

// SSE: Generate Kickstarter campaign copy section by section
router.post("/projects/:projectId/kickstarter/generate", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const [entities, rules, players, assets] = await Promise.all([
    db.select().from(entitiesTable).where(eq(entitiesTable.projectId, projectId)).orderBy(asc(entitiesTable.type)),
    db.select().from(rulesTable).where(eq(rulesTable.projectId, projectId)).orderBy(asc(rulesTable.priority)),
    db.select().from(playersTable).where(eq(playersTable.projectId, projectId)),
    db.select().from(assetsTable).where(eq(assetsTable.projectId, projectId)),
  ]);

  const gameContext = `
Game Name: ${project.name}
Genre: ${project.genre || "Board Game"}
Description: ${project.description || "A strategic board game"}
Player Count: ${project.playerCount || "2-4"}
Play Time: ${project.targetDuration || "60-90 minutes"}

Entities (${entities.length}): ${entities.map(e => `${e.name} [${e.type}]`).join(", ")}

Core Rules (${rules.length}): ${rules.slice(0, 8).map(r => r.title).join(", ")}

Player Archetypes (${players.length}): ${players.map(p => p.name).join(", ")}

Assets/Components (${assets.length}): ${assets.map(a => `${a.name} (${a.assetType})`).join(", ")}
  `.trim();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const prompt = `You are an expert Kickstarter campaign writer specializing in board games. Write a complete, compelling Kickstarter campaign for the following game.

${gameContext}

Generate the full campaign in this exact JSON structure:
{
  "tagline": "A punchy 1-line hook (max 15 words)",
  "elevatorPitch": "2-3 sentence compelling summary for the campaign header",
  "story": "3-4 paragraph narrative about why this game was made, what makes it special, and the designer's vision. Make it personal and compelling.",
  "whatsInTheBox": [
    { "item": "Component name", "quantity": "X pieces", "description": "Brief description" }
  ],
  "howToPlay": "3-4 paragraph engaging description of gameplay flow — opening setup through endgame. Focus on exciting moments and key decisions.",
  "pledgeTiers": [
    { "name": "Tier name", "price": 35, "items": ["Item 1", "Item 2"], "description": "What backers get" }
  ],
  "stretchGoals": [
    { "amount": 50000, "title": "Goal name", "description": "What unlocks" }
  ],
  "faq": [
    { "question": "Question?", "answer": "Answer." }
  ],
  "risks": "2-3 paragraphs about production risks and how you plan to mitigate them. Be honest but confident.",
  "closingStatement": "2-3 sentence call to action to back the project"
}

Rules:
- pledgeTiers: exactly 4 tiers at $35, $55, $85, $130
- stretchGoals: exactly 6 goals from $30k to $200k
- faq: exactly 6 questions covering shipping, components, gameplay, replayability, player count, expansions
- whatsInTheBox: include all components (infer counts from entities and assets, add standard items like dice, rulebook)
- Use the actual game name, entities, rules, and player archetypes in the copy — do NOT use generic placeholders
- Write professional, exciting marketing copy — this should read like a real Kickstarter campaign

Return ONLY the JSON, no markdown wrapping.`;

  try {
    let fullText = "";
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        fullText += chunk.delta.text;
        send({ content: chunk.delta.text });
      }
    }

    // Parse and send structured result
    try {
      const clean = fullText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const campaign = JSON.parse(clean);
      send({ done: true, campaign });
    } catch {
      send({ done: true, raw: fullText });
    }
    res.end();
  } catch (e) {
    send({ error: String(e) });
    res.end();
  }
});

// GET: Print-ready Kickstarter campaign page
router.get("/projects/:projectId/kickstarter-print", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).send("Invalid project ID"); return; }

  const campaignParam = req.query.campaign as string | undefined;
  if (!campaignParam) {
    res.status(400).send("No campaign data provided. Generate a campaign first.");
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).send("Project not found"); return; }

  let campaign: {
    tagline?: string; elevatorPitch?: string; story?: string;
    whatsInTheBox?: { item: string; quantity: string; description: string }[];
    howToPlay?: string; pledgeTiers?: { name: string; price: number; items: string[]; description: string }[];
    stretchGoals?: { amount: number; title: string; description: string }[];
    faq?: { question: string; answer: string }[];
    risks?: string; closingStatement?: string;
  };

  try {
    campaign = JSON.parse(decodeURIComponent(campaignParam));
  } catch {
    res.status(400).send("Invalid campaign data");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${project.name} — Kickstarter Campaign</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', serif; color: #1a1a1a; background: white; }
    .page { max-width: 780px; margin: 0 auto; padding: 40px 48px; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #05CE78; color: white; border: none; padding: 10px 22px; cursor: pointer; font-size: 0.9em; border-radius: 6px; font-family: sans-serif; font-weight: bold; z-index: 9999; }
    .print-btn:hover { background: #04b86c; }
    .hero { background: #1a1a2e; color: white; padding: 48px; margin: -40px -48px 40px; text-align: center; }
    .game-badge { display: inline-block; background: #05CE78; color: white; font-size: 0.75em; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; padding: 5px 14px; border-radius: 20px; margin-bottom: 16px; font-family: sans-serif; }
    .hero h1 { font-size: 3em; margin-bottom: 12px; letter-spacing: -1px; }
    .tagline { font-size: 1.3em; color: #05CE78; font-style: italic; margin-bottom: 20px; }
    .elevator { font-size: 1.05em; color: #ccc; line-height: 1.7; max-width: 600px; margin: 0 auto; }
    h2 { font-size: 1.5em; margin: 36px 0 12px; border-bottom: 3px solid #1a1a2e; padding-bottom: 8px; color: #1a1a2e; page-break-after: avoid; }
    h3 { font-size: 1.05em; margin: 18px 0 6px; color: #333; page-break-after: avoid; }
    p { font-size: 0.95em; line-height: 1.8; color: #333; margin-bottom: 12px; }
    .component-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
    .component-card { border: 1px solid #e0e0e0; padding: 10px 14px; border-radius: 6px; page-break-inside: avoid; }
    .component-qty { font-size: 0.75em; text-transform: uppercase; letter-spacing: 1px; color: #05CE78; font-weight: bold; font-family: sans-serif; }
    .component-name { font-weight: bold; margin: 2px 0 4px; }
    .component-desc { font-size: 0.85em; color: #666; }
    .tier-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 12px 0; }
    .tier { border: 2px solid #e0e0e0; border-radius: 8px; padding: 16px; page-break-inside: avoid; }
    .tier.featured { border-color: #05CE78; }
    .tier-price { font-size: 1.8em; font-weight: bold; color: #1a1a2e; }
    .tier-name { font-size: 0.75em; text-transform: uppercase; letter-spacing: 1.5px; color: #888; font-family: sans-serif; margin-bottom: 8px; }
    .tier-items { list-style: disc; padding-left: 16px; font-size: 0.85em; line-height: 1.7; color: #555; margin: 8px 0; }
    .tier-desc { font-size: 0.8em; color: #777; margin-top: 6px; }
    .stretch-list { margin: 10px 0; }
    .stretch-item { display: flex; gap: 14px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #f0f0f0; page-break-inside: avoid; }
    .stretch-amount { font-weight: bold; font-size: 0.9em; color: #05CE78; font-family: sans-serif; white-space: nowrap; min-width: 80px; }
    .stretch-title { font-weight: bold; font-size: 0.95em; margin-bottom: 2px; }
    .stretch-desc { font-size: 0.85em; color: #666; }
    .faq-item { margin: 14px 0; page-break-inside: avoid; }
    .faq-q { font-weight: bold; margin-bottom: 4px; }
    .faq-a { font-size: 0.9em; color: #555; }
    .closing { background: #1a1a2e; color: white; padding: 32px; border-radius: 8px; margin-top: 40px; text-align: center; page-break-inside: avoid; }
    .closing p { color: #ccc; }
    .closing .cta { font-size: 1.2em; color: #05CE78; font-weight: bold; margin-top: 12px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 0.8em; color: #aaa; text-align: center; font-family: sans-serif; }
    @media print {
      body { font-size: 10.5pt; }
      .no-print { display: none !important; }
      .print-btn { display: none !important; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">Save as PDF</button>
<div class="page">

<div class="hero">
  <div class="game-badge">Kickstarter Campaign</div>
  <h1>${project.name}</h1>
  ${campaign.tagline ? `<div class="tagline">${campaign.tagline}</div>` : ""}
  ${campaign.elevatorPitch ? `<div class="elevator">${campaign.elevatorPitch}</div>` : ""}
</div>

${campaign.story ? `
<h2>Our Story</h2>
${campaign.story.split("\n\n").map(p => `<p>${p}</p>`).join("")}
` : ""}

${campaign.whatsInTheBox?.length ? `
<h2>What's in the Box</h2>
<div class="component-grid">
${campaign.whatsInTheBox.map(c => `
<div class="component-card">
  <div class="component-qty">${c.quantity}</div>
  <div class="component-name">${c.item}</div>
  ${c.description ? `<div class="component-desc">${c.description}</div>` : ""}
</div>`).join("")}
</div>
` : ""}

${campaign.howToPlay ? `
<h2 class="page-break">How to Play</h2>
${campaign.howToPlay.split("\n\n").map(p => `<p>${p}</p>`).join("")}
` : ""}

${campaign.pledgeTiers?.length ? `
<h2>Pledge Tiers</h2>
<div class="tier-grid">
${campaign.pledgeTiers.map((t, i) => `
<div class="tier ${i === 1 ? "featured" : ""}">
  <div class="tier-price">$${t.price}</div>
  <div class="tier-name">${t.name}</div>
  <ul class="tier-items">${t.items.map(item => `<li>${item}</li>`).join("")}</ul>
  <div class="tier-desc">${t.description}</div>
</div>`).join("")}
</div>
` : ""}

${campaign.stretchGoals?.length ? `
<h2>Stretch Goals</h2>
<div class="stretch-list">
${campaign.stretchGoals.map(g => `
<div class="stretch-item">
  <div class="stretch-amount">$${g.amount.toLocaleString()}</div>
  <div>
    <div class="stretch-title">${g.title}</div>
    <div class="stretch-desc">${g.description}</div>
  </div>
</div>`).join("")}
</div>
` : ""}

${campaign.faq?.length ? `
<h2>Frequently Asked Questions</h2>
${campaign.faq.map(f => `
<div class="faq-item">
  <div class="faq-q">Q: ${f.question}</div>
  <div class="faq-a">A: ${f.answer}</div>
</div>`).join("")}
` : ""}

${campaign.risks ? `
<h2>Risks & Challenges</h2>
${campaign.risks.split("\n\n").map(p => `<p>${p}</p>`).join("")}
` : ""}

${campaign.closingStatement ? `
<div class="closing">
  <p>${campaign.closingStatement}</p>
  <div class="cta">Back ${project.name} Today →</div>
</div>
` : ""}

<div class="footer">
  ${project.name} Kickstarter Campaign &nbsp;·&nbsp; Generated by AI Board Game Factory &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" })}
</div>
</div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
