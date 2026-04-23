import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db, userSettingsTable } from "@workspace/db";

export type AIProvider = "anthropic" | "gemini" | "openai" | "xai";

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

export type Message = { role: "user" | "assistant"; content: string };

const PROVIDER_BASE_URLS: Partial<Record<AIProvider, string>> = {
  gemini: "https://generative-ai.googleapis.com/v1beta/openai/",
  xai: "https://api.x.ai/v1",
};

export const AI_PROVIDERS: Record<AIProvider, { label: string; description: string; models: { id: string; label: string; note: string }[] }> = {
  anthropic: {
    label: "Anthropic",
    description: "Claude models — excellent reasoning, best for complex game design tasks.",
    models: [
      { id: "claude-haiku-4-5", label: "Claude Haiku", note: "Fast & cheap — recommended default" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet", note: "Balanced quality & cost" },
      { id: "claude-opus-4-7", label: "Claude Opus", note: "Most powerful, highest cost" },
    ],
  },
  gemini: {
    label: "Google Gemini",
    description: "Gemini models — very cost-effective, large context window.",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", note: "Fastest & cheapest — great default" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", note: "High-quality, larger context" },
    ],
  },
  openai: {
    label: "OpenAI",
    description: "GPT models — reliable and widely supported.",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini", note: "Cheap & fast" },
      { id: "gpt-4o", label: "GPT-4o", note: "Flagship quality" },
    ],
  },
  xai: {
    label: "xAI Grok",
    description: "Grok models — strong reasoning, real-time knowledge.",
    models: [
      { id: "grok-3-mini", label: "Grok 3 Mini", note: "Fast & economical" },
      { id: "grok-3", label: "Grok 3", note: "Full capability" },
    ],
  },
};

export async function getUserAIConfig(userId: string | null | undefined): Promise<AIConfig> {
  const fallback: AIConfig = {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  };

  if (!userId) return fallback;

  try {
    const [settings] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId));
    if (!settings) return fallback;

    const provider = settings.provider as AIProvider;
    const model = settings.model;

    const keyMap: Record<AIProvider, string | null | undefined> = {
      anthropic: settings.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
      gemini: settings.geminiApiKey,
      openai: settings.openaiApiKey,
      xai: settings.xaiApiKey,
    };

    const apiKey = keyMap[provider] ?? "";
    if (!apiKey) return fallback;

    return { provider, model, apiKey };
  } catch {
    return fallback;
  }
}

export async function streamAI(
  config: AIConfig,
  messages: Message[],
  onChunk: (text: string) => void,
  options: { system?: string; maxTokens?: number } = {},
): Promise<string> {
  const maxTokens = options.maxTokens ?? 8192;
  let fullText = "";

  if (config.provider === "anthropic") {
    const client = new Anthropic({ apiKey: config.apiKey });
    const stream = client.messages.stream({
      model: config.model,
      max_tokens: maxTokens,
      ...(options.system ? { system: options.system } : {}),
      messages,
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullText += event.delta.text;
        onChunk(event.delta.text);
      }
    }
  } else {
    const baseURL = PROVIDER_BASE_URLS[config.provider];
    const client = new OpenAI({ apiKey: config.apiKey, ...(baseURL ? { baseURL } : {}) });
    const allMessages: OpenAI.ChatCompletionMessageParam[] = [
      ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
      ...messages,
    ];
    const stream = await client.chat.completions.create({
      model: config.model,
      max_tokens: maxTokens,
      messages: allMessages,
      stream: true,
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
  }

  return fullText;
}

export async function callAI(
  config: AIConfig,
  messages: Message[],
  options: { system?: string; maxTokens?: number } = {},
): Promise<string> {
  const maxTokens = options.maxTokens ?? 8192;

  if (config.provider === "anthropic") {
    const client = new Anthropic({ apiKey: config.apiKey });
    const response = await client.messages.create({
      model: config.model,
      max_tokens: maxTokens,
      ...(options.system ? { system: options.system } : {}),
      messages,
    });
    return response.content[0]?.type === "text" ? response.content[0].text : "";
  } else {
    const baseURL = PROVIDER_BASE_URLS[config.provider];
    const client = new OpenAI({ apiKey: config.apiKey, ...(baseURL ? { baseURL } : {}) });
    const allMessages: OpenAI.ChatCompletionMessageParam[] = [
      ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
      ...messages,
    ];
    const response = await client.chat.completions.create({
      model: config.model,
      max_tokens: maxTokens,
      messages: allMessages,
    });
    return response.choices[0]?.message?.content ?? "";
  }
}
