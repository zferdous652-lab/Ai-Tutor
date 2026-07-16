export interface ProviderConfig {
  name: "anthropic" | "gemini" | "openai";
  apiKey: string;
}

export const ALL_PROVIDER_NAMES: ProviderConfig["name"][] = ["anthropic", "gemini", "openai"];

const ENV_VAR_BY_PROVIDER: Record<ProviderConfig["name"], string> = {
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
};

/** An env var always takes precedence over a key entered via the admin UI (see
 * services/llm/settings.ts) — this lets a deploy "lock" a provider's key via docker-compose /
 * .env while still letting other, unset providers be managed live from the UI. */
export function getEnvApiKey(name: ProviderConfig["name"]): string | undefined {
  return process.env[ENV_VAR_BY_PROVIDER[name]];
}

export function envVarNameFor(name: ProviderConfig["name"]): string {
  return ENV_VAR_BY_PROVIDER[name];
}

const DEFAULT_PROVIDER_ORDER = (process.env.MODEL_PROVIDER_ORDER?.split(",").map((s) => s.trim()) ??
  ALL_PROVIDER_NAMES) as ProviderConfig["name"][];

export const env = {
  port: Number(process.env.PORT ?? 4000),
  // Default fallback order used the first time the Model Router Settings row is created — an
  // admin can reorder/enable/disable providers (and add API keys for providers with no env var
  // set) from that tab afterwards, without a redeploy. Whether ANY provider ends up usable is
  // resolved dynamically per-call in services/llm/settings.ts, not required at startup, since a
  // key can now be added later from the UI.
  defaultProviderOrder: DEFAULT_PROVIDER_ORDER,
};
