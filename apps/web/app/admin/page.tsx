"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ChapterSummary, TutorPackAdminView } from "../../lib/api";
import { useSession } from "../../lib/session";

export default function AdminPage() {
  const { userId, me, loading: sessionLoading } = useSession();
  const [packs, setPacks] = useState<TutorPackAdminView[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!userId) return;
    setPacks(await api.adminListPacks(userId));
  }

  useEffect(() => {
    if (me?.role === "ADMIN") refresh().catch((err) => setError(String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, me]);

  // Upload processing happens in the background (see docs/ARCHITECTURE.md); poll while any
  // pack is still PROCESSING so status/chapters appear without a manual refresh.
  useEffect(() => {
    if (me?.role !== "ADMIN") return;
    if (!packs.some((p) => p.status === "PROCESSING")) return;
    const interval = setInterval(() => {
      refresh().catch((err) => setError(String(err)));
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, packs]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget);
      await api.adminUploadPack(userId, form);
      e.currentTarget.reset();
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate(kind: "summary" | "quiz", chapterId: string) {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "summary") await api.adminGenerateSummary(userId, chapterId);
      else await api.adminGenerateQuiz(userId, chapterId);
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish(tutorPackId: string) {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminPublishPack(userId, tutorPackId);
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(chapterId: string, title: string) {
    if (!userId || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminRenameChapter(userId, chapterId, title.trim());
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(chapterId: string) {
    if (!userId) return;
    if (!confirm("Delete this chapter? This can't be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminDeleteChapter(userId, chapterId);
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!userId) return <p>Sign in on the home page first.</p>;
  if (sessionLoading) return <p>Loading...</p>;
  if (me?.role !== "ADMIN") return <p>This dashboard is for admins only.</p>;

  return (
    <div>
      <div className="card">
        <h2>Create a Tutor Pack</h2>
        <form onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" name="title" required placeholder="Form 1 Sejarah" />
          </div>
          <div className="field">
            <label htmlFor="subject">Subject</label>
            <input id="subject" name="subject" defaultValue="Sejarah" />
          </div>
          <div className="field">
            <label htmlFor="standard">Standard</label>
            <input id="standard" name="standard" defaultValue="KSSM" />
          </div>
          <div className="field">
            <label htmlFor="tier">Tier</label>
            <select id="tier" name="tier" defaultValue="BASIC">
              <option value="BASIC">Basic — pre-generated content only</option>
              <option value="PREMIUM">Premium — adds live AI chat</option>
              <option value="XPOINTS">X-Points — pay-per-use live AI chat</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="file">Course material (PDF)</label>
            <input id="file" name="file" type="file" accept="application/pdf" required />
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "Processing..." : "Upload & Process"}
          </button>
        </form>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {packs.map((pack) => (
        <div key={pack.id} className="card">
          <h3>
            {pack.title} — {pack.status}
            {pack.publishedAt ? " · Published" : " · Draft"}
          </h3>
          <p>
            {pack.subject} · {pack.standard} · {pack.tier} · {pack.chapters.length} chapters
          </p>
          <ul>
            {pack.chapters.map((chapter) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                busy={busy}
                reviewable={!pack.publishedAt}
                onGenerate={(kind) => handleGenerate(kind, chapter.id)}
                onRename={(title) => handleRename(chapter.id, title)}
                onDelete={() => handleDelete(chapter.id)}
              />
            ))}
          </ul>
          {!pack.publishedAt && (
            <button disabled={busy || pack.status !== "DRAFT"} onClick={() => handlePublish(pack.id)}>
              Publish for students
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function ChapterRow({
  chapter,
  busy,
  reviewable,
  onGenerate,
  onRename,
  onDelete,
}: {
  chapter: ChapterSummary;
  busy: boolean;
  reviewable: boolean;
  onGenerate: (kind: "summary" | "quiz") => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(chapter.title);
  const dirty = title.trim() !== chapter.title && title.trim().length > 0;

  return (
    <li style={{ marginBottom: 12 }}>
      {reviewable ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1 }} />
          {dirty && (
            <button disabled={busy} onClick={() => onRename(title)}>
              Save
            </button>
          )}
          <button disabled={busy} onClick={onDelete} style={{ background: "crimson" }}>
            Delete
          </button>
        </div>
      ) : (
        <strong>{chapter.title}</strong>
      )}
      <div style={{ marginTop: 4 }}>
        {chapter.summary ? "✅ summarized" : ""} {chapter.quiz ? "✅ quiz" : ""}
      </div>
      <div style={{ marginTop: 4 }}>
        <button disabled={busy} onClick={() => onGenerate("summary")}>
          Generate summary
        </button>{" "}
        <button disabled={busy} onClick={() => onGenerate("quiz")}>
          Generate quiz
        </button>
      </div>
    </li>
  );
}
