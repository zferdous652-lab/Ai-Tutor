import { prisma } from "../../lib/prisma";
import { ALL_PROVIDER_NAMES, env, ProviderConfig } from "../../lib/env";

const SETTINGS_ID = "singleton";

export interface ProviderStatus {
  name: ProviderConfig["name"];
  /** Whether an API key is set for this provider via env vars. Disabling/reordering never
   * requires (or stores) a key — that stays in env vars / docker-compose secrets. */
  configured: boolean;
  enabled: boolean;
  /** 1-based fallback position among configured+enabled providers, or null if not usable. */
  priority: number | null;
}

/** Providers with an API key configured, in the DEFAULT_PROVIDER_ORDER — used to seed the
 * settings row the first time it's read, and as the source of truth for which providers can be
 * enabled at all. */
const configuredNames = new Set(env.providers.map((p) => p.name));

async function loadRow() {
  const existing = await prisma.modelRouterSetting.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return prisma.modelRouterSetting.create({
    data: {
      id: SETTINGS_ID,
      providerOrder: env.providers.map((p) => p.name),
      disabledProviders: [],
    },
  });
}

/** Effective fallback order: admin-configured order (if set), filtered to providers that still
 * have an API key configured and aren't disabled. Falls back to env.providers' order if a
 * provider gains a key after the settings row was created (so it isn't silently ignored). */
export async function resolveActiveProviderOrder(): Promise<ProviderConfig["name"][]> {
  const row = await loadRow();
  const disabled = new Set(row.disabledProviders);
  const known = row.providerOrder.filter((name): name is ProviderConfig["name"] =>
    ALL_PROVIDER_NAMES.includes(name as ProviderConfig["name"])
  );
  const missing = env.providers.map((p) => p.name).filter((name) => !known.includes(name));
  return [...known, ...missing].filter((name) => configuredNames.has(name) && !disabled.has(name));
}

export async function getProviderStatuses(): Promise<ProviderStatus[]> {
  const row = await loadRow();
  const disabled = new Set(row.disabledProviders);
  const activeOrder = await resolveActiveProviderOrder();
  const known = row.providerOrder.filter((name): name is ProviderConfig["name"] =>
    ALL_PROVIDER_NAMES.includes(name as ProviderConfig["name"])
  );
  const missing = ALL_PROVIDER_NAMES.filter((name) => !known.includes(name));
  return [...known, ...missing].map((name) => ({
    name,
    configured: configuredNames.has(name),
    enabled: configuredNames.has(name) && !disabled.has(name),
    priority: activeOrder.includes(name) ? activeOrder.indexOf(name) + 1 : null,
  }));
}

export async function updateProviderSettings(
  order: ProviderConfig["name"][],
  disabled: ProviderConfig["name"][]
): Promise<ProviderStatus[]> {
  const invalid = [...order, ...disabled].filter(
    (name) => !ALL_PROVIDER_NAMES.includes(name)
  );
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
