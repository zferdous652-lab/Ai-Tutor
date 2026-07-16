"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ProviderName, ProviderStatus } from "../../../lib/api";
import { useSession } from "../../../lib/session";

const PROVIDER_LABEL: Record<ProviderName, string> = {
  anthropic: "Anthropic (Claude)",
  gemini: "Google Gemini",
  openai: "OpenAI (GPT)",
};

const PROVIDER_HINT: Record<ProviderName, string> = {
  anthropic: "Get a key from console.anthropic.com",
  gemini: "Get a key from Google AI Studio (aistudio.google.com)",
  openai: "Get a key from platform.openai.com",
};

export default function ModelSettingsPage() {
  const { userId, me, loading: sessionLoading } = useSession();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!userId) return;
    const { providers } = await api.adminGetModelSettings(userId);
    setProviders(providers);
    setLoaded(true);
  }

  useEffect(() => {
    if (me?.role === "ADMIN") refresh().catch((err) => setError(String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, me]);

  async function reorder(next: ProviderStatus[]) {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const order = next.map((p) => p.name);
      const disabled = next.filter((p) => !p.enabled).map((p) => p.name);
      const { providers } = await api.adminUpdateModelSettings(userId, order, disabled);
      setProviders(providers);
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
    reorder(next);
  }

  function toggleEnabled(index: number) {
    const provider = providers[index];
    if (!provider.configured) return;
    const next = providers.map((p, i) => (i === index ? { ...p, enabled: !p.enabled } : p));
    reorder(next);
  }

  async function saveKey(name: ProviderName, apiKey: string) {
    if (!userId || !apiKey.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { providers } = await api.adminSetProviderApiKey(userId, name, apiKey.trim());
      setProviders(providers);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeKey(name: ProviderName) {
    if (!userId) return;
    if (!confirm(`Remove the saved API key for ${PROVIDER_LABEL[name]}? It will stop working until a new key is added.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { providers } = await api.adminRemoveProviderApiKey(userId, name);
      setProviders(providers);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
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
          Add API keys and control the AI provider fallback chain. The first enabled provider is
          tried first for every summary, quiz, and chat reply; if it hits a rate limit, outage, or
          auth failure, the router automatically falls back to the next one.
        </p>
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {loaded && enabledCount === 0 && (
        <p className="alert alert-error">
          No providers are enabled — add an API key below to turn AI generation and chat back on.
        </p>
      )}

      {!loaded && <div className="card empty-state">Loading providers...</div>}

      {providers.map((provider, index) => (
        <ProviderCard
          key={provider.name}
          provider={provider}
          index={index}
          count={providers.length}
          busy={busy}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
          onToggleEnabled={() => toggleEnabled(index)}
          onSaveKey={(key) => saveKey(provider.name, key)}
          onRemoveKey={() => removeKey(provider.name)}
        />
      ))}
    </div>
  );
}

function ProviderCard({
  provider,
  index,
  count,
  busy,
  onMoveUp,
  onMoveDown,
  onToggleEnabled,
  onSaveKey,
  onRemoveKey,
}: {
  provider: ProviderStatus;
  index: number;
  count: number;
  busy: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleEnabled: () => void;
  onSaveKey: (apiKey: string) => void;
  onRemoveKey: () => void;
}) {
  const [keyInput, setKeyInput] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const lockedByEnv = provider.keySource === "env";

  function handleSubmitKey(e: FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    onSaveKey(keyInput);
    setKeyInput("");
    setEditingKey(false);
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex-row" style={{ alignItems: "center", gap: 8 }}>
          <span className="badge">{provider.priority ? `Priority ${provider.priority}` : "Unused"}</span>
          <h3 style={{ margin: 0 }}>{PROVIDER_LABEL[provider.name]}</h3>
          <span className={`badge ${provider.enabled ? "badge-published" : "badge-draft"}`}>
            {provider.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <div className="flex-row" style={{ gap: 6 }}>
          <button
            className="btn-secondary btn-sm"
            disabled={busy || index === 0}
            onClick={onMoveUp}
            aria-label={`Move ${provider.name} up`}
          >
            ↑
          </button>
          <button
            className="btn-secondary btn-sm"
            disabled={busy || index === count - 1}
            onClick={onMoveDown}
            aria-label={`Move ${provider.name} down`}
          >
            ↓
          </button>
          <button
            className="btn-secondary btn-sm"
            disabled={busy || !provider.configured}
            onClick={onToggleEnabled}
          >
            {provider.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      {provider.configured ? (
        <div className="card-meta" style={{ marginBottom: 0 }}>
          <span>
            API key: <code>{provider.keyPreview}</code>
          </span>
          <span className="dot">·</span>
          <span>
            {lockedByEnv ? (
              <>Set via <code>{provider.envVarName}</code> env var</>
            ) : (
              "Saved from this dashboard"
            )}
          </span>
        </div>
      ) : (
        <p className="field-hint" style={{ marginTop: 0 }}>
          No API key configured. {PROVIDER_HINT[provider.name]}.
        </p>
      )}

      {lockedByEnv && (
        <p className="field-hint mt-2">
          This key is locked by the <code>{provider.envVarName}</code> environment variable — remove
          it from your deploy config and redeploy to manage it from here instead.
        </p>
      )}

      {!lockedByEnv && !editingKey && (
        <button className="btn-secondary btn-sm mt-2" disabled={busy} onClick={() => setEditingKey(true)}>
          {provider.configured ? "Replace key" : "Add key"}
        </button>
      )}

      {!lockedByEnv && provider.configured && (
        <button className="btn-danger btn-sm mt-2" style={{ marginLeft: 8 }} disabled={busy} onClick={onRemoveKey}>
          Remove key
        </button>
      )}

      {!lockedByEnv && editingKey && (
        <form onSubmit={handleSubmitKey} className="mt-2">
          <div className="flex-row" style={{ gap: 6 }}>
            <input
              type="password"
              autoComplete="off"
              placeholder={`Paste ${PROVIDER_LABEL[provider.name]} API key`}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="flex-1"
            />
            <button type="submit" className="btn-sm" disabled={busy || !keyInput.trim()}>
              Save
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={busy}
              onClick={() => {
                setEditingKey(false);
                setKeyInput("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
