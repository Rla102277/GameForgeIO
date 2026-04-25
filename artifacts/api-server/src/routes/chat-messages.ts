import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, projectChatMessagesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/projects/:projectId/chat/:chatType/messages", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const chatType = req.params.chatType;
  if (!["overview", "design"].includes(chatType)) { res.status(400).json({ error: "chatType must be overview or design" }); return; }

  const userId = (req as any).auth?.userId ?? null;

  const messages = await db
    .select()
    .from(projectChatMessagesTable)
    .where(
      and(
        eq(projectChatMessagesTable.projectId, projectId),
        eq(projectChatMessagesTable.chatType, chatType),
        userId
          ? eq(projectChatMessagesTable.userId, userId)
          : eq(projectChatMessagesTable.chatType, chatType),
      ),
    )
    .orderBy(asc(projectChatMessagesTable.createdAt))
    .limit(200);

  res.json(messages);
});

router.post("/projects/:projectId/chat/:chatType/messages", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

  const chatType = req.params.chatType;
  if (!["overview", "design"].includes(chatType)) { res.status(400).json({ error: "Invalid chatType" }); return; }

  const userId = (req as any).auth?.userId ?? null;
  const { role, content } = req.body as { role: string; content: string };

  if (!role || !content) { res.status(400).json({ error: "role and content required" }); return; }

  const [msg] = await db.insert(projectChatMessagesTable).values({
    projectId,
    userId,
    chatType,
    role,
    content,
  }).returning();

  res.json(msg);
});

router.delete("/projects/:projectId/chat/:chatType/messages", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const chatType = req.params.chatType;
  await db.delete(projectChatMessagesTable).where(
    and(
      eq(projectChatMessagesTable.projectId, projectId),
      eq(projectChatMessagesTable.chatType, chatType),
    ),
  );
  res.json({ success: true });
});

export default router;
