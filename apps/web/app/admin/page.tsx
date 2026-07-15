"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, TutorPackAdminView } from "../../lib/api";
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
              <li key={chapter.id} style={{ marginBottom: 8 }}>
                {chapter.title} {chapter.summary ? "✅ summarized" : ""}{" "}
                {chapter.quiz ? "✅ quiz" : ""}
                <div>
                  <button disabled={busy} onClick={() => handleGenerate("summary", chapter.id)}>
                    Generate summary
                  </button>{" "}
                  <button disabled={busy} onClick={() => handleGenerate("quiz", chapter.id)}>
                    Generate quiz
                  </button>
                </div>
              </li>
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
