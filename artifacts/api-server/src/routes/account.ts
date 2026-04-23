import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userSettingsTable } from "@workspace/db";
import { AI_PROVIDERS } from "../lib/ai-provider";

const router: IRouter = Router();

router.get("/account/settings", async (req, res): Promise<void> => {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [settings] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId));

  const mask = (key: string | null | undefined, prefix = "sk-") =>
    key ? `${prefix}...${key.slice(-4)}` : null;

  if (!settings) {
    res.json({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      hasEnvAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      anthropicKeyHint: process.env.ANTHROPIC_API_KEY ? "sk-ant-...(shared key)" : null,
      openaiKeyHint: null,
      geminiKeyHint: null,
      xaiKeyHint: null,
      providers: AI_PROVIDERS,
    });
    return;
  }

  res.json({
    provider: settings.provider,
    model: settings.model,
    hasEnvAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    anthropicKeyHint: settings.anthropicApiKey
      ? mask(settings.anthropicApiKey, "sk-ant-")
      : process.env.ANTHROPIC_API_KEY ? "sk-ant-...(shared key)" : null,
    openaiKeyHint: mask(settings.openaiApiKey, "sk-"),
    geminiKeyHint: mask(settings.geminiApiKey, "AIza"),
    xaiKeyHint: mask(settings.xaiApiKey, "xai-"),
    providers: AI_PROVIDERS,
  });
});

router.put("/account/settings", async (req, res): Promise<void> => {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { provider, model, anthropicApiKey, openaiApiKey, geminiApiKey, xaiApiKey } = req.body as Record<string, string | undefined>;

  const [existing] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId));

  const updates: Partial<typeof userSettingsTable.$inferInsert> = {};
  if (provider) updates.provider = provider;
  if (model) updates.model = model;
  if (anthropicApiKey !== undefined) updates.anthropicApiKey = anthropicApiKey || null;
  if (openaiApiKey !== undefined) updates.openaiApiKey = openaiApiKey || null;
  if (geminiApiKey !== undefined) updates.geminiApiKey = geminiApiKey || null;
  if (xaiApiKey !== undefined) updates.xaiApiKey = xaiApiKey || null;

  if (existing) {
    await db.update(userSettingsTable).set(updates).where(eq(userSettingsTable.userId, userId));
  } else {
    await db.insert(userSettingsTable).values({ userId, ...updates });
  }

  res.json({ success: true });
});

export default router;
