import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, projectsTable, entitiesTable, rulesTable, playersTable, notesTable, projectChatMessagesTable } from "@workspace/db";
import { streamAI, getNarrativeAIConfig } from "../lib/ai-provider";

const router: IRouter = Router();

router.post("/projects/:projectId/overview/chat", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const { message, history = [] } = req.body as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
  };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const [entities, rules, players, notes] = await Promise.all([
    db.select({ name: entitiesTable.name, type: entitiesTable.type, description: entitiesTable.description }).from(entitiesTable).where(eq(entitiesTable.projectId, projectId)).orderBy(asc(entitiesTable.type)),
    db.select({ title: rulesTable.title, content: rulesTable.content, category: rulesTable.category, priority: rulesTable.priority }).from(rulesTable).where(eq(rulesTable.projectId, projectId)).orderBy(asc(rulesTable.category)),
    db.select({ name: playersTable.name, playstyle: playersTable.playstyle, description: playersTable.description }).from(playersTable).where(eq(playersTable.projectId, projectId)),
    db.select({ title: notesTable.title, content: notesTable.content }).from(notesTable).where(eq(notesTable.projectId, projectId)).limit(10),
  ]);

  const systemPrompt = `You are an expert board game design advisor for "${project.name}" — a ${project.genre || "strategy"} game.${project.description ? ` Game concept: ${project.description}` : ""}

You have full context of the project:

ENTITIES (${entities.length}):
${entities.map(e => `• ${e.type}: ${e.name}${e.description ? ` — ${e.description.slice(0, 80)}` : ""}`).join("\n") || "None defined yet"}

RULES (${rules.length}):
${rules.map(r => `• [${r.category}] ${r.title}: ${r.content?.slice(0, 100) ?? ""}`).join("\n") || "None defined yet"}

PLAYERS (${players.length}):
${players.map(p => `• ${p.name}${p.playstyle ? ` (${p.playstyle})` : ""}${p.description ? ` — ${p.description.slice(0, 60)}` : ""}`).join("\n") || "None defined yet"}

DESIGNER'S NOTES:
${notes.map(n => `• ${n.title}: ${n.content?.slice(0, 80)}`).join("\n") || "No notes yet"}

You're here to help the designer think through their game. Answer questions, suggest improvements, spot design problems, brainstorm mechanics, and help refine the game's direction. Be direct, specific, and practically useful. Reference the actual project data in your answers.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...history.slice(-10),
    { role: "user", content: message },
  ];

  const aiConfig = getNarrativeAIConfig();
  const userId = (req as any).auth?.userId as string | null ?? null;

  try {
    const fullResponse = await streamAI(aiConfig, messages, (text) => { send({ content: text }); }, { system: systemPrompt, maxTokens: 1200 });

    await db.insert(projectChatMessagesTable).values([
      { projectId, userId, chatType: "overview", role: "user", content: message },
      { projectId, userId, chatType: "overview", role: "assistant", content: fullResponse },
    ]);

    send({ done: true });
    res.end();
  } catch (e) {
    send({ error: String(e) });
    res.end();
  }
});

export default router;
