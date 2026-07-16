export interface ProviderConfig {
  name: "anthropic" | "gemini" | "openai";
  apiKey: string;
}

export const ALL_PROVIDER_NAMES: ProviderConfig["name"][] = ["anthropic", "gemini", "openai"];

const DEFAULT_PROVIDER_ORDER: ProviderConfig["name"][] = ALL_PROVIDER_NAMES;

function resolveProviders(): ProviderConfig[] {
  const order = (process.env.MODEL_PROVIDER_ORDER?.split(",").map((s) => s.trim()) ??
    DEFAULT_PROVIDER_ORDER) as ProviderConfig["name"][];

  const available: Record<ProviderConfig["name"], string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  };

  const providers = order
    .filter((name) => available[name])
    .map((name) => ({ name, apiKey: available[name]! }));

  if (providers.length === 0) {
    throw new Error(
      "No LLM provider configured. Set at least one of ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY."
    );
  }
  return providers;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  // Providers with an API key configured via env vars, in MODEL_PROVIDER_ORDER (or the default
  // order). This is the *default* fallback order — an admin can reorder/disable providers at
  // runtime from the "Model Router Settings" tab, which is layered on top of this in
  // services/llm/settings.ts and does not require an env var change or redeploy.
  providers: resolveProviders(),
};
