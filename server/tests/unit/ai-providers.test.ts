import { afterEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../src/app/utils/app-error.ts";
import {
  buildProviderList,
  requestJsonWithProviders,
  type ProviderConfig,
} from "../../src/ai/providers.ts";

const providerConfig: ProviderConfig = {
  openRouterApiKey: "openrouter-test-key",
  openRouterBaseUrl: "https://openrouter.example/v1/",
  openRouterModel: "baidu/ernie-5.5-flash-preview:free",
  frontendUrl: "https://mealio.example",
  groqApiKey: "groq-test-key",
  geminiApiKey: "gemini-test-key",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AI provider fallback", () => {
  it("resolves providers in OpenRouter, Groq, Gemini priority order", () => {
    const providers = buildProviderList(providerConfig);

    expect(providers.map((provider) => provider.name)).toEqual(["openrouter", "groq", "gemini"]);
    expect(providers.map((provider) => provider.model)).toEqual([
      "baidu/ernie-5.5-flash-preview:free",
      "llama-3.3-70b-versatile",
      "gemini-3.5-flash-lite",
    ]);
    expect(buildProviderList({ ...providerConfig, openRouterApiKey: undefined }).map((provider) => provider.name)).toEqual([
      "groq",
      "gemini",
    ]);
  });

  it("falls through on provider errors and schema-invalid summaries", async () => {
    const providers = buildProviderList(providerConfig);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ summary: "", highlights: [], concerns: [] }) } }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "Deposits covered most approved expenses.",
                    highlights: ["The month closed with positive cash."],
                    concerns: [],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 120, completion_tokens: 32 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await requestJsonWithProviders(
      providers,
      [{ role: "user", content: "Summarize this report" }],
      1500,
      (text) => {
        const summary = JSON.parse(text) as { summary?: string };
        if (!summary.summary) {
          throw new AppError("Invalid report summary", 502, "AI_PROVIDER_ERROR");
        }
      },
    );

    expect(result.provider).toBe("gemini");
    expect(result.model).toBe("gemini-3.5-flash-lite");
    expect(result.tokensPrompt).toBe(120);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://openrouter.example/v1/chat/completions",
      "https://api.groq.com/openai/v1/chat/completions",
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    ]);
  });
});
