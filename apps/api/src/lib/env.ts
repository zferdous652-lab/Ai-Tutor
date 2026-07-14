export interface ProviderConfig {
  name: "anthropic" | "gemini";
  apiKey: string;
}

const DEFAULT_PROVIDER_ORDER: ProviderConfig["name"][] = ["anthropic", "gemini"];

function resolveProviders(): ProviderConfig[] {
  const order = (process.env.MODEL_PROVIDER_ORDER?.split(",").map((s) => s.trim()) ??
    DEFAULT_PROVIDER_ORDER) as ProviderConfig["name"][];

  const available: Record<ProviderConfig["name"], string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };

  const providers = order
    .filter((name) => available[name])
    .map((name) => ({ name, apiKey: available[name]! }));

  if (providers.length === 0) {
    throw new Error(
      "No LLM provider configured. Set at least one of ANTHROPIC_API_KEY or GEMINI_API_KEY."
    );
  }
  return providers;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  providers: resolveProviders(),
};
