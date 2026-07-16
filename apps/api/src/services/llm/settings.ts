import { prisma } from "../../lib/prisma";
import { ALL_PROVIDER_NAMES, env, envVarNameFor, getEnvApiKey, ProviderConfig } from "../../lib/env";
import { decryptSecret, encryptSecret } from "../../lib/crypto";

const SETTINGS_ID = "singleton";

export interface ProviderStatus {
  name: ProviderConfig["name"];
  configured: boolean;
  enabled: boolean;
  /** 1-based fallback position among configured+enabled providers, or null if not usable. */
  priority: number | null;
  /** Where the active API key comes from — "env" always wins over "database" if both are set. */
  keySource: "env" | "database" | "none";
  /** Masked preview (e.g. "sk-a...9f2c") for confirming the right key was saved, never the
   * full key. Null if not configured. */
  keyPreview: string | null;
  /** The env var name this provider reads from, e.g. "OPENAI_API_KEY" — surfaced so the UI can
   * explain how to override a database-managed key via deploy config, or why a key field is
   * locked when the env var is already set. */
  envVarName: string;
}

async function loadSettingsRow() {
  const existing = await prisma.modelRouterSetting.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return prisma.modelRouterSetting.create({
    data: { id: SETTINGS_ID, providerOrder: env.defaultProviderOrder, disabledProviders: [] },
  });
}

interface KeySource {
  source: "env" | "database";
  apiKey: string;
}

/** Effective API key per provider: env var wins if set, otherwise a key entered via the admin
 * UI (decrypted). Rows that fail to decrypt (e.g. CREDENTIAL_ENCRYPTION_KEY changed) are treated
 * as not configured rather than crashing the whole router. */
async function getKeySources(): Promise<Map<ProviderConfig["name"], KeySource>> {
  const map = new Map<ProviderConfig["name"], KeySource>();
  for (const name of ALL_PROVIDER_NAMES) {
    const envKey = getEnvApiKey(name);
    if (envKey) map.set(name, { source: "env", apiKey: envKey });
  }
  const rows = await prisma.providerCredential.findMany();
  for (const row of rows) {
    const name = row.name as ProviderConfig["name"];
    if (map.has(name)) continue; // env wins
    try {
      map.set(name, { source: "database", apiKey: decryptSecret(row.apiKeyEnc) });
    } catch {
      // Corrupt/undecryptable — surfaces as "none" until re-entered via the UI.
    }
  }
  return map;
}

async function loadState() {
  const [row, sources] = await Promise.all([loadSettingsRow(), getKeySources()]);
  const disabled = new Set(row.disabledProviders);
  const known = row.providerOrder.filter((n): n is ProviderConfig["name"] =>
    ALL_PROVIDER_NAMES.includes(n as ProviderConfig["name"])
  );
  const missing = ALL_PROVIDER_NAMES.filter((n) => !known.includes(n));
  const fullOrder = [...known, ...missing];
  const activeOrder = fullOrder.filter((name) => sources.has(name) && !disabled.has(name));
  return { fullOrder, disabled, sources, activeOrder };
}

export async function resolveActiveProviderOrder(): Promise<ProviderConfig["name"][]> {
  return (await loadState()).activeOrder;
}

export async function getEffectiveApiKey(name: ProviderConfig["name"]): Promise<string | undefined> {
  return (await getKeySources()).get(name)?.apiKey;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export async function getProviderStatuses(): Promise<ProviderStatus[]> {
  const { fullOrder, disabled, sources, activeOrder } = await loadState();
  return fullOrder.map((name) => {
    const src = sources.get(name);
    return {
      name,
      configured: !!src,
      enabled: !!src && !disabled.has(name),
      priority: activeOrder.includes(name) ? activeOrder.indexOf(name) + 1 : null,
      keySource: src?.source ?? "none",
      keyPreview: src ? maskKey(src.apiKey) : null,
      envVarName: envVarNameFor(name),
    };
  });
}

export async function updateProviderSettings(
  order: ProviderConfig["name"][],
  disabled: ProviderConfig["name"][]
): Promise<ProviderStatus[]> {
  const invalid = [...order, ...disabled].filter((name) => !ALL_PROVIDER_NAMES.includes(name));
  if (invalid.length > 0) {
    throw new Error(`Unknown provider name(s): ${invalid.join(", ")}`);
  }
  // De-dupe order, and make sure every known provider name is present so a future toggle isn't
  // silently dropped from the list.
  const dedupedOrder = [...new Set(order)];
  const fullOrder = [...dedupedOrder, ...ALL_PROVIDER_NAMES.filter((n) => !dedupedOrder.includes(n))];

  await prisma.modelRouterSetting.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, providerOrder: fullOrder, disabledProviders: [...new Set(disabled)] },
    update: { providerOrder: fullOrder, disabledProviders: [...new Set(disabled)] },
  });
  return getProviderStatuses();
}

/** Saves an API key entered via the admin UI, encrypted at rest. Refuses if an env var is
 * already set for this provider, since that would always win anyway — surfacing that as an
 * error (rather than silently no-oping) avoids an admin thinking they changed the active key
 * when they didn't. */
export async function setProviderApiKey(name: ProviderConfig["name"], apiKey: string): Promise<void> {
  if (getEnvApiKey(name)) {
    throw new Error(
      `${envVarNameFor(name)} is already set via the environment, which always takes precedence. ` +
        `Remove it from your deploy config (.env / docker-compose) and redeploy to manage this key from here instead.`
    );
  }
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("API key cannot be empty");
  }
  const apiKeyEnc = encryptSecret(trimmed);
  await prisma.providerCredential.upsert({
    where: { name },
    create: { name, apiKeyEnc },
    update: { apiKeyEnc },
  });
}

export async function removeProviderApiKey(name: ProviderConfig["name"]): Promise<void> {
  await prisma.providerCredential.deleteMany({ where: { name } });
}
