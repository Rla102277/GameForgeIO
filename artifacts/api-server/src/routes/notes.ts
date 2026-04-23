import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notesTable, projectsTable, entitiesTable, rulesTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

router.get("/projects/:projectId/notes", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const notes = await db.select().from(notesTable)
    .where(eq(notesTable.projectId, projectId))
    .orderBy(desc(notesTable.pinned), desc(notesTable.updatedAt));
  res.json(notes);
});

router.post("/projects/:projectId/notes", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const { title = "", content = "", color = "slate", pinned = false } = req.body;
  const [note] = await db.insert(notesTable).values({ projectId, title, content, color, pinned }).returning();
  res.json(note);
});

router.put("/projects/:projectId/notes/:noteId", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const noteId = parseInt(req.params.noteId, 10);
  if (isNaN(projectId) || isNaN(noteId)) { res.status(400).json({ error: "Invalid IDs" }); return; }
  const { title, content, color, pinned, topic, lookAtLater } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (color !== undefined) updates.color = color;
  if (pinned !== undefined) updates.pinned = pinned;
  if (topic !== undefined) updates.topic = topic;
  if (lookAtLater !== undefined) updates.lookAtLater = lookAtLater;
  const [note] = await db.update(notesTable).set(updates).where(and(eq(notesTable.id, noteId), eq(notesTable.projectId, projectId))).returning();
  if (!note) { res.status(404).json({ error: "Note not found" }); return; }
  res.json(note);
});

router.delete("/projects/:projectId/notes/:noteId", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const noteId = parseInt(req.params.noteId, 10);
  if (isNaN(projectId) || isNaN(noteId)) { res.status(400).json({ error: "Invalid IDs" }); return; }
  await db.delete(notesTable).where(and(eq(notesTable.id, noteId), eq(notesTable.projectId, projectId)));
  res.json({ success: true });
});

router.post("/projects/:projectId/notes/ai-brainstorm", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const { topic } = req.body as { topic?: string };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const [entities, rules] = await Promise.all([
    db.select({ name: entitiesTable.name, type: entitiesTable.type }).from(entitiesTable).where(eq(entitiesTable.projectId, projectId)).limit(20),
    db.select({ title: rulesTable.title, category: rulesTable.category }).from(rulesTable).where(eq(rulesTable.projectId, projectId)).limit(20),
  ]);

  const context = `Game: "${project.name}" (${project.genre || "strategy"})
${project.description ? `Description: ${project.description}` : ""}
Entities: ${entities.map(e => `${e.name} (${e.type})`).join(", ") || "none yet"}
Rules: ${rules.map(r => r.title).join(", ") || "none yet"}`;

  const prompt = `${context}

Generate 6 creative, specific game design ideas${topic ? ` about: "${topic}"` : ""} for this board game. Each idea should be a brief, actionable note a designer would write to themselves — concrete enough to act on, creative enough to inspire.

Return ONLY a JSON array, no explanation:
[
  {"title": "Short idea title", "content": "2-3 sentence description of the idea", "color": "blue|amber|green|purple|red|slate"},
  ...
]

Vary the colors. Make each idea distinct and useful.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    const ideas = match ? JSON.parse(match[0]) : [];
    res.json({ ideas });
  } catch {
    res.status(500).json({ error: "AI brainstorm failed" });
  }
});

// AI: auto-assign topics to all notes
router.post("/projects/:projectId/notes/ai-organize-topics", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const notes = await db.select({ id: notesTable.id, title: notesTable.title, content: notesTable.content })
    .from(notesTable).where(eq(notesTable.projectId, projectId));
  if (notes.length === 0) { res.json({ assignments: [] }); return; }

  const prompt = `You are a board game design advisor. Categorize each design note into one of these topics:
core_loop, mechanics, player_experience, economy, theme, balance, accessibility, marketing

Notes to categorize:
${notes.map(n => `[id:${n.id}] "${n.title || "(untitled)"}: ${n.content}"`).join("\n")}

Return ONLY a JSON array (no markdown):
[{"noteId": <number>, "topic": "<topic_id>"}, ...]

Use only the exact topic IDs listed above. Assign every note.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5", max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    const assignments = match ? JSON.parse(match[0]) : [];
    res.json({ assignments });
  } catch {
    res.status(500).json({ error: "AI organize topics failed" });
  }
});

// Streaming chat with full game context (SSE)
router.post("/projects/:projectId/notes/chat", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const { messages = [] } = req.body as { messages: { role: "user" | "assistant"; content: string }[] };

  const [project, notes, rules, entities] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).then(r => r[0]),
    db.select({ title: notesTable.title, content: notesTable.content, pinned: notesTable.pinned }).from(notesTable).where(eq(notesTable.projectId, projectId)).orderBy(desc(notesTable.pinned)).limit(40),
    db.select({ title: rulesTable.title, content: rulesTable.content, category: rulesTable.category }).from(rulesTable).where(eq(rulesTable.projectId, projectId)).limit(30),
    db.select({ name: entitiesTable.name, type: entitiesTable.type, description: entitiesTable.description }).from(entitiesTable).where(eq(entitiesTable.projectId, projectId)).limit(25),
  ]);

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const systemPrompt = `You are a collaborative board game design advisor helping the designer iterate on "${project.name}" (${project.genre || "strategy game"}).
${project.description ? `\nGame description: ${project.description}` : ""}

== CURRENT DESIGN NOTES (${notes.length}) ==
${notes.length > 0 ? notes.map(n => `• ${n.pinned ? "[PINNED] " : ""}${n.title ? n.title + ": " : ""}${n.content}`).join("\n") : "No notes yet."}

== RULES (${rules.length}) ==
${rules.length > 0 ? rules.map(r => `• [${r.category}] ${r.title}: ${r.content}`).join("\n") : "No rules yet."}

== ENTITIES (${entities.length}) ==
${entities.length > 0 ? entities.map(e => `• ${e.name} (${e.type})${e.description ? ": " + e.description : ""}`).join("\n") : "No entities yet."}

You are a thoughtful, concise design partner. Help the designer refine mechanics, spot problems, explore ideas, and improve the game. When suggesting rule changes, be specific and actionable. Keep responses focused and conversational — avoid overly long walls of text unless the designer asks for depth.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "Chat failed" })}\n\n`);
    res.end();
  }
});

// Per-note: suggest specific rule changes based on a note
router.post("/projects/:projectId/notes/:noteId/suggest-rule-changes", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const noteId = parseInt(req.params.noteId, 10);
  if (isNaN(projectId) || isNaN(noteId)) { res.status(400).json({ error: "Invalid IDs" }); return; }

  const [note] = await db.select().from(notesTable).where(and(eq(notesTable.id, noteId), eq(notesTable.projectId, projectId)));
  if (!note) { res.status(404).json({ error: "Note not found" }); return; }

  const [project, rules, entities] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).then(r => r[0]),
    db.select({ id: rulesTable.id, title: rulesTable.title, content: rulesTable.content, category: rulesTable.category }).from(rulesTable).where(eq(rulesTable.projectId, projectId)),
    db.select({ name: entitiesTable.name, type: entitiesTable.type }).from(entitiesTable).where(eq(entitiesTable.projectId, projectId)).limit(15),
  ]);

  const prompt = `You are a board game design advisor.

Game: "${project?.name}" (${project?.genre || "strategy"})
Entities: ${entities.map(e => `${e.name} (${e.type})`).join(", ") || "none"}

Current rules:
${rules.map(r => `[id:${r.id}] "${r.title}" (${r.category}): ${r.content}`).join("\n") || "none yet"}

Design note to implement:
Title: "${note.title}"
Content: "${note.content}"

Based on this note, suggest 1-4 specific rule changes or new rules to implement this idea. Prefer updating existing rules over creating new ones.

Return ONLY a JSON array (no markdown):
[
  {"type":"update","ruleId":<number>,"ruleTitle":"<current title>","proposedTitle":"<new title or same>","currentContent":"<current text>","proposedContent":"<improved rule text>","rationale":"<one sentence>","category":"<category>"},
  {"type":"create","ruleTitle":"<new rule title>","proposedContent":"<full rule text>","rationale":"<one sentence>","category":"movement|combat|economy|turn_structure|variant"}
]`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5", max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    res.json({ changes: match ? JSON.parse(match[0]) : [] });
  } catch {
    res.status(500).json({ error: "Suggest rule changes failed" });
  }
});

// Global: suggest comprehensive rule changes based on ALL notes
router.post("/projects/:projectId/notes/suggest-global-changes", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const [project, notes, rules, entities] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).then(r => r[0]),
    db.select().from(notesTable).where(eq(notesTable.projectId, projectId)).orderBy(desc(notesTable.pinned)),
    db.select({ id: rulesTable.id, title: rulesTable.title, content: rulesTable.content, category: rulesTable.category }).from(rulesTable).where(eq(rulesTable.projectId, projectId)),
    db.select({ name: entitiesTable.name, type: entitiesTable.type }).from(entitiesTable).where(eq(entitiesTable.projectId, projectId)).limit(15),
  ]);

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (notes.length === 0) { res.json({ changes: [] }); return; }

  const prompt = `You are a board game design advisor doing a comprehensive rules review.

Game: "${project.name}" (${project.genre || "strategy"})
Entities: ${entities.map(e => `${e.name} (${e.type})`).join(", ") || "none"}

All design notes (${notes.length} total):
${notes.map(n => `- "${n.title || "(untitled)"}: ${n.content}"`).join("\n")}

Current rules (${rules.length} total):
${rules.map(r => `[id:${r.id}] "${r.title}" (${r.category}): ${r.content}`).join("\n") || "none yet"}

Based on ALL design notes, suggest 3-8 comprehensive rule changes. Look for themes repeated across notes, gaps in the ruleset, and rules that need updating to match the design direction.

Return ONLY a JSON array (no markdown):
[
  {"type":"update","ruleId":<number>,"ruleTitle":"<current title>","proposedTitle":"<new title or same>","currentContent":"<current text>","proposedContent":"<improved text>","rationale":"<one sentence connecting to notes>","category":"<category>"},
  {"type":"create","ruleTitle":"<new rule title>","proposedContent":"<full rule text>","rationale":"<one sentence>","category":"movement|combat|economy|turn_structure|variant"}
]`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5", max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    res.json({ changes: match ? JSON.parse(match[0]) : [] });
  } catch {
    res.status(500).json({ error: "Suggest global changes failed" });
  }
});

export default router;
