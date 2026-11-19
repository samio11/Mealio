import { env } from "../app/config/env.ts";
import { AppError } from "../app/utils/app-error.ts";
import { logger } from "../app/utils/logger.ts";

/**
 * OpenAI-compatible chat providers in fallback order: OpenRouter, Groq, Gemini.
 * Replies are parsed and validated by the caller before they are used.
 */

export interface ChatProvider {
  name: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  extraHeaders?: Record<string, string>;
}

export interface ChatMessage {
  role: "system" | "user";
  content:
    | string
    | (
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      )[];
}

export interface ChatJsonResult {
  text: string;
  provider: string;
  model: string;
  tokensPrompt: number | null;
  tokensCompletion: number | null;
}

export interface ProviderConfig {
  openRouterApiKey?: string;
  openRouterBaseUrl: string;
  openRouterModel: string;
  frontendUrl: string;
  groqApiKey?: string;
  geminiApiKey?: string;
}

export const AI_REQUEST_TIMEOUT_MS = 30_000;

/** Builds the configured provider chain in the required priority order. */
export function buildProviderList(config: ProviderConfig): ChatProvider[] {
  const providers: ChatProvider[] = [];

  if (config.openRouterApiKey) {
    providers.push({
      name: "openrouter",
      model: config.openRouterModel,
      apiKey: config.openRouterApiKey,
      baseUrl: config.openRouterBaseUrl.replace(/\/+$/, ""),
      extraHeaders: { "HTTP-Referer": config.frontendUrl, "X-Title": "Mealio" },
    });
  }

  if (config.groqApiKey) {
    providers.push({
      name: "groq",
      model: "llama-3.3-70b-versatile",
      apiKey: config.groqApiKey,
      baseUrl: "https://api.groq.com/openai/v1",
    });
  }

  if (config.geminiApiKey) {
    providers.push({
      name: "gemini",
      model: "gemini-3.5-flash-lite",
      apiKey: config.geminiApiKey,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    });
  }

  return providers;
}

/** Providers available on this deployment, in priority order. */
export function resolveProviders(): ChatProvider[] {
  return buildProviderList({
    openRouterApiKey: env.OPENROUTER_API_KEY,
    openRouterBaseUrl: env.OPENROUTER_BASE_URL,
    openRouterModel: env.AI_TEXT_MODEL,
    frontendUrl: env.FRONTEND_URL,
    groqApiKey: env.GROQ_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
  });
}

export function isAiConfigured(): boolean {
  return resolveProviders().length > 0;
}

export type JsonResponseValidator = (text: string) => void;

async function callProvider(
  provider: ChatProvider,
  messages: ChatMessage[],
  maxTokens: number,
  validateResponse?: JsonResponseValidator,
): Promise<ChatJsonResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        ...(provider.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        // Generous budget: some free models emit reasoning tokens before the reply.
        max_tokens: maxTokens,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AppError(
        `AI provider "${provider.name}" responded ${response.status}`,
        502,
        "AI_PROVIDER_ERROR",
        body.slice(0, 500),
      );
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const text = payload.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) {
      throw new AppError(`AI provider "${provider.name}" returned an empty reply`, 502, "AI_PROVIDER_ERROR");
    }

    validateResponse?.(text);

    return {
      text,
      provider: provider.name,
      model: provider.model,
      tokensPrompt: payload.usage?.prompt_tokens ?? null,
      tokensCompletion: payload.usage?.completion_tokens ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Sends the messages to the first provider that succeeds. Throws
 * `AI_PROVIDER_ERROR` only when every configured provider fails — callers must
 * then fall back to the manual workflow.
 */
export async function requestJson(
  messages: ChatMessage[],
  maxTokens = 2000,
  validateResponse?: JsonResponseValidator,
): Promise<ChatJsonResult> {
  return requestJsonWithProviders(resolveProviders(), messages, maxTokens, validateResponse);
}

export async function requestJsonWithProviders(
  providers: ChatProvider[],
  messages: ChatMessage[],
  maxTokens = 2000,
  validateResponse?: JsonResponseValidator,
): Promise<ChatJsonResult> {
  if (providers.length === 0) {
    throw new AppError("No AI provider is configured", 503, "AI_PROVIDER_ERROR");
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      return await callProvider(provider, messages, maxTokens, validateResponse);
    } catch (error) {
      lastError = error;
      logger.warn({ err: error, provider: provider.name }, "AI provider call failed; trying next");
    }
  }

  throw lastError instanceof AppError
    ? lastError
    : new AppError("All AI providers failed", 502, "AI_PROVIDER_ERROR");
}

/**
 * Extracts the first JSON object from a model reply. Models occasionally wrap
 * JSON in prose or code fences even when asked not to, so be forgiving here but
 * leave semantic validation to Zod.
 */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new AppError("AI reply was not valid JSON", 502, "AI_PROVIDER_ERROR");
  }
}
