"use client";

import { useEffect, useState } from "react";
import { api, ProviderName, ProviderStatus } from "../../../lib/api";
import { useSession } from "../../../lib/session";

const PROVIDER_LABEL: Record<ProviderName, string> = {
  anthropic: "Anthropic (Claude)",
  gemini: "Google Gemini",
  openai: "OpenAI (GPT)",
};

export default function ModelSettingsPage() {
  const { userId, me, loading: sessionLoading } = useSession();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function refresh() {
    if (!userId) return;
    const { providers } = await api.adminGetModelSettings(userId);
    setProviders(providers);
  }

  useEffect(() => {
    if (me?.role === "ADMIN") refresh().catch((err) => setError(String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, me]);

  async function save(next: ProviderStatus[]) {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const order = next.map((p) => p.name);
      const disabled = next.filter((p) => !p.enabled).map((p) => p.name);
      const { providers } = await api.adminUpdateModelSettings(userId, order, disabled);
      setProviders(providers);
      setSavedAt(Date.now());
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= providers.length) return;
    const next = [...providers];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  }

  function toggleEnabled(index: number) {
    const next = providers.map((p, i) => (i === index ? { ...p, enabled: !p.enabled } : p));
    save(next);
  }

  if (!userId) return <p className="state-page">Sign in on the home page first.</p>;
  if (sessionLoading) return <p className="state-page">Loading...</p>;
  if (me?.role !== "ADMIN") return <p className="state-page">This dashboard is for admins only.</p>;

  const enabledCount = providers.filter((p) => p.enabled && p.configured).length;

  return (
    <div>
      <div className="page-header">
        <h1>Model Router Settings</h1>
        <p>
          Control the AI provider fallback chain. The first enabled, configured provider is tried
          first for every summary, quiz, and chat reply; if it hits a rate limit, outage, or auth
          failure, the router automatically falls back to the next one — no redeploy needed.
        </p>
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {enabledCount === 0 && (
        <p className="alert alert-error">
          No providers are both configured and enabled — AI generation and chat will fail until at
          least one is turned on below.
        </p>
      )}

      <div className="card">
        <h2>Fallback order</h2>
        {providers.length === 0 && <div className="empty-state">Loading providers...</div>}
        <ul className="plain">
          {providers.map((provider, index) => (
            <li key={provider.name} className="list-item list-item-row">
              <div className="flex-row" style={{ alignItems: "center", gap: 8 }}>
                <span className="badge">{provider.priority ?? "—"}</span>
                <strong>{PROVIDER_LABEL[provider.name]}</strong>
                {!provider.configured && (
                  <span className="badge badge-draft">No API key configured</span>
                )}
                {provider.configured && (
                  <span className={`badge ${provider.enabled ? "badge-published" : "badge-draft"}`}>
                    {provider.enabled ? "Enabled" : "Disabled"}
                  </span>
                )}
              </div>
              <div className="flex-row" style={{ gap: 6 }}>
                <button
                  className="btn-secondary btn-sm"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Move ${provider.name} up`}
                >
                  ↑
                </button>
                <button
                  className="btn-secondary btn-sm"
                  disabled={busy || index === providers.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Move ${provider.name} down`}
                >
                  ↓
                </button>
                <button
                  className="btn-secondary btn-sm"
                  disabled={busy || !provider.configured}
                  onClick={() => toggleEnabled(index)}
                >
                  {provider.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {savedAt && !busy && !error && <p className="field-hint">Saved.</p>}
        <p className="field-hint mt-2">
          A provider without an API key can be reordered but can&apos;t be enabled — set its key
          via the corresponding env var (e.g. <code>OPENAI_API_KEY</code>) and redeploy first.
          Reordering and enabling/disabling providers, on the other hand, takes effect immediately.
        </p>
      </div>
    </div>
  );
}
