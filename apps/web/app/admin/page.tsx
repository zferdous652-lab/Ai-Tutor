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
    // Capture the form element now — e.currentTarget is nulled out by the DOM once this
    // event handler's dispatch phase ends, so using it after an `await` throws.
    const formEl = e.currentTarget;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(formEl);
      await api.adminUploadPack(userId, form);
      formEl.reset();
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

  async function handleDeletePack(tutorPackId: string) {
    if (!userId) return;
    if (!confirm("Delete this Tutor Pack and all its chapters? This can't be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminDeletePack(userId, tutorPackId);
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

  if (!userId) return <p className="state-page">Sign in on the home page first.</p>;
  if (sessionLoading) return <p className="state-page">Loading...</p>;
  if (me?.role !== "ADMIN") return <p className="state-page">This dashboard is for admins only.</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Admin dashboard</h1>
        <p>Upload course material, review chapters, and publish Tutor Packs.</p>
      </div>

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
          <div className="field field-checkbox">
            <label>
              <input type="checkbox" name="analyzeVisuals" value="true" /> Also analyze
              diagrams, maps, and photos (slower, additional AI cost)
            </label>
          </div>
          <button type="submit" disabled={busy}>
            {busy && <span className="spinner" />}
            {busy ? "Uploading..." : "Upload & Process"}
          </button>
          {busy && (
            <p className="field-hint">
              Large PDFs can take a few minutes to upload and process — please don&apos;t close
              or refresh this page. Once the upload completes it&apos;ll appear below with status
              PROCESSING, then flip to DRAFT automatically when parsing finishes.
            </p>
          )}
        </form>
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      {packs.length === 0 && (
        <div className="empty-state">No Tutor Packs yet — create one above to get started.</div>
      )}

      {packs.map((pack) => (
        <div key={pack.id} className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>{pack.title}</h3>
            <button
              className="btn-danger btn-sm"
              disabled={busy}
              onClick={() => handleDeletePack(pack.id)}
            >
              Delete pack
            </button>
          </div>
          <div className="card-meta">
            {pack.status !== "DRAFT" && (
              <span className={`badge badge-${pack.status.toLowerCase()}`}>{pack.status}</span>
            )}
            <span className={`badge ${pack.publishedAt ? "badge-published" : "badge-draft"}`}>
              {pack.publishedAt ? "Published" : "Draft"}
            </span>
            <span className={`badge badge-${pack.tier.toLowerCase()}`}>{pack.tier}</span>
            <span className="dot">·</span>
            <span>{pack.subject}</span>
            <span className="dot">·</span>
            <span>{pack.standard}</span>
            <span className="dot">·</span>
            <span>{pack.chapters.length} chapters</span>
            {pack.visualNotes && (
              <>
                <span className="dot">·</span>
                <span>{pack.visualNotes.length} figures captioned</span>
              </>
            )}
          </div>
          <ul className="plain">
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
            <button
              className="mt-2"
              disabled={busy || pack.status !== "DRAFT"}
              onClick={() => handlePublish(pack.id)}
            >
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
    <li className="list-item">
      {reviewable ? (
        <div className="flex-row">
          <input
            className="flex-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {dirty && (
            <button className="btn-secondary btn-sm" disabled={busy} onClick={() => onRename(title)}>
              Save
            </button>
          )}
          <button className="btn-danger btn-sm" disabled={busy} onClick={onDelete}>
            Delete
          </button>
        </div>
      ) : (
        <strong>{chapter.title}</strong>
      )}
      <div className="card-meta mt-2" style={{ marginBottom: 0 }}>
        {chapter.summary && <span className="badge badge-published">Summarized</span>}
        {chapter.quiz && <span className="badge badge-published">Quiz ready</span>}
      </div>
      <div className="flex-row mt-2">
        <button className="btn-secondary btn-sm" disabled={busy} onClick={() => onGenerate("summary")}>
          Generate summary
        </button>
        <button className="btn-secondary btn-sm" disabled={busy} onClick={() => onGenerate("quiz")}>
          Generate quiz
        </button>
      </div>
    </li>
  );
}
