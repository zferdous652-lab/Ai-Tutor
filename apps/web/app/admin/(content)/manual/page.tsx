"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  api,
  ChapterAdminDetail,
  PackTier,
  QuizQuestion,
  TutorPackAdminView,
} from "../../../../lib/api";
import { useSession } from "../../../../lib/session";

const BLANK_QUESTION: QuizQuestion = {
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  topic: "",
};

export default function ManualContentPage() {
  const { userId, me, loading: sessionLoading } = useSession();
  const [packs, setPacks] = useState<TutorPackAdminView[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!userId) return;
    const all = await api.adminListPacks(userId);
    setPacks(all.filter((p) => p.source === "MANUAL"));
  }

  useEffect(() => {
    if (me?.role === "ADMIN") refresh().catch((err) => setError(String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, me]);

  async function handleCreatePack(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;
    const formEl = e.currentTarget;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(formEl);
      await api.adminCreateManualPack(userId, {
        title: String(form.get("title") ?? ""),
        subject: String(form.get("subject") ?? "Sejarah"),
        standard: String(form.get("standard") ?? "KSSM"),
        tier: form.get("tier") as PackTier,
      });
      formEl.reset();
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

  if (!userId) return <p className="state-page">Sign in on the home page first.</p>;
  if (sessionLoading) return <p className="state-page">Loading...</p>;
  if (me?.role !== "ADMIN") return <p className="state-page">This dashboard is for admins only.</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Pre-Set Contents Manually</h1>
        <p>
          Author a Tutor Pack's chapters, summaries, and quizzes yourself — no PDF upload, no AI
          involved anywhere on this page.
        </p>
      </div>

      <div className="card">
        <h2>Create a Tutor Pack</h2>
        <form onSubmit={handleCreatePack}>
          <div className="field">
            <label htmlFor="m-title">Title</label>
            <input id="m-title" name="title" required placeholder="Form 1 Sejarah" />
          </div>
          <div className="field">
            <label htmlFor="m-subject">Subject</label>
            <input id="m-subject" name="subject" defaultValue="Sejarah" />
          </div>
          <div className="field">
            <label htmlFor="m-standard">Standard</label>
            <input id="m-standard" name="standard" defaultValue="KSSM" />
          </div>
          <div className="field">
            <label htmlFor="m-tier">Tier</label>
            <select id="m-tier" name="tier" defaultValue="BASIC">
              <option value="BASIC">Basic — pre-generated content only</option>
              <option value="PREMIUM">Premium — adds live AI chat</option>
              <option value="XPOINTS">X-Points — pay-per-use live AI chat</option>
            </select>
          </div>
          <button type="submit" disabled={busy}>
            Create pack
          </button>
        </form>
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      {packs.length === 0 && (
        <div className="empty-state">No manually-created Tutor Packs yet — create one above.</div>
      )}

      {packs.map((pack) => (
        <ManualPackCard
          key={pack.id}
          summary={pack}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onChanged={refresh}
          onDeletePack={() => handleDeletePack(pack.id)}
          onPublish={() => handlePublish(pack.id)}
        />
      ))}
    </div>
  );
}

function ManualPackCard({
  summary,
  busy,
  setBusy,
  setError,
  onChanged,
  onDeletePack,
  onPublish,
}: {
  summary: TutorPackAdminView;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  onChanged: () => Promise<void>;
  onDeletePack: () => void;
  onPublish: () => void;
}) {
  const { userId } = useSession();
  const [chapters, setChapters] = useState<ChapterAdminDetail[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState("");

  async function loadDetail() {
    if (!userId) return;
    const detail = await api.adminGetPack(userId, summary.id);
    setChapters(detail.chapters);
  }

  useEffect(() => {
    loadDetail().catch((err) => setError(String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.id, summary.chapters.length]);

  async function refreshBoth() {
    await Promise.all([loadDetail(), onChanged()]);
  }

  async function handleAddChapter(e: FormEvent) {
    e.preventDefault();
    if (!userId || !newChapterTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminCreateChapter(userId, summary.id, newChapterTitle.trim());
      setNewChapterTitle("");
      await refreshBoth();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteChapter(chapterId: string) {
    if (!userId) return;
    if (!confirm("Delete this chapter? This can't be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminDeleteChapter(userId, chapterId);
      await refreshBoth();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 style={{ margin: 0 }}>{summary.title}</h3>
        <button className="btn-danger btn-sm" disabled={busy} onClick={onDeletePack}>
          Delete pack
        </button>
      </div>
      <div className="card-meta">
        <span className={`badge ${summary.publishedAt ? "badge-published" : "badge-draft"}`}>
          {summary.publishedAt ? "Published" : "Draft"}
        </span>
        <span className={`badge badge-${summary.tier.toLowerCase()}`}>{summary.tier}</span>
        <span className="dot">·</span>
        <span>{summary.subject}</span>
        <span className="dot">·</span>
        <span>{summary.standard}</span>
        <span className="dot">·</span>
        <span>{chapters.length} chapters</span>
      </div>

      {chapters.length === 0 && (
        <div className="empty-state">No chapters yet — add one below.</div>
      )}

      <ul className="plain">
        {chapters.map((chapter) => (
          <ManualChapterCard
            key={chapter.id}
            chapter={chapter}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onChanged={refreshBoth}
            onDelete={() => handleDeleteChapter(chapter.id)}
          />
        ))}
      </ul>

      {!summary.publishedAt && (
        <form onSubmit={handleAddChapter} className="flex-row mt-2">
          <input
            className="flex-1"
            placeholder="New chapter title"
            value={newChapterTitle}
            onChange={(e) => setNewChapterTitle(e.target.value)}
          />
          <button type="submit" className="btn-secondary btn-sm" disabled={busy || !newChapterTitle.trim()}>
            Add chapter
          </button>
        </form>
      )}

      {!summary.publishedAt && (
        <div className="flex-row mt-2">
          <Link href={`/admin/pack/${summary.id}/review`} className="btn-secondary">
            Review content
          </Link>
          <button disabled={busy || chapters.length === 0} onClick={onPublish}>
            Publish for students
          </button>
        </div>
      )}
    </div>
  );
}

function ManualChapterCard({
  chapter,
  busy,
  setBusy,
  setError,
  onChanged,
  onDelete,
}: {
  chapter: ChapterAdminDetail;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  onChanged: () => Promise<void>;
  onDelete: () => void;
}) {
  const { userId } = useSession();
  const [summaryDraft, setSummaryDraft] = useState(chapter.summary ?? "");
  const [questions, setQuestions] = useState<QuizQuestion[]>(chapter.quiz?.questions ?? []);

  useEffect(() => {
    setSummaryDraft(chapter.summary ?? "");
    setQuestions(chapter.quiz?.questions ?? []);
  }, [chapter.summary, chapter.quiz]);

  async function handleSaveSummary() {
    if (!userId || !summaryDraft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminSetChapterSummary(userId, chapter.id, summaryDraft.trim());
      await onChanged();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  function updateQuestion(index: number, patch: Partial<QuizQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updateOption(index: number, optIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index ? { ...q, options: q.options.map((o, oi) => (oi === optIndex ? value : o)) } : q
      )
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { ...BLANK_QUESTION, options: [...BLANK_QUESTION.options] }]);
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  const quizValid =
    questions.length > 0 &&
    questions.every(
      (q) =>
        q.question.trim() &&
        q.topic.trim() &&
        q.options.length === 4 &&
        q.options.every((o) => o.trim())
    );

  async function handleSaveQuiz() {
    if (!userId || !quizValid) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminSetChapterQuiz(userId, chapter.id, questions);
      await onChanged();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="list-item">
      <div className="flex-row">
        <strong className="flex-1">{chapter.title}</strong>
        <button className="btn-danger btn-sm" disabled={busy} onClick={onDelete}>
          Delete
        </button>
      </div>

      <div className="mt-2">
        <label className="field-hint">Summary</label>
        <textarea
          rows={3}
          style={{ width: "100%", fontFamily: "inherit", resize: "vertical" }}
          value={summaryDraft}
          onChange={(e) => setSummaryDraft(e.target.value)}
          placeholder="Write the chapter summary a student will read..."
        />
        <button
          className={chapter.summary ? "btn-success btn-sm mt-2" : "btn-secondary btn-sm mt-2"}
          disabled={busy || !summaryDraft.trim()}
          onClick={handleSaveSummary}
        >
          {chapter.summary ? "✓ Summary saved" : "Save summary"}
        </button>
      </div>

      <div className="mt-4">
        <label className="field-hint">Quiz questions</label>
        {questions.map((q, i) => (
          <div key={i} className="card mt-2" style={{ background: "var(--color-surface-muted)" }}>
            <div className="flex-row">
              <input
                className="flex-1"
                placeholder="Question"
                value={q.question}
                onChange={(e) => updateQuestion(i, { question: e.target.value })}
              />
              <button className="btn-danger btn-sm" disabled={busy} onClick={() => removeQuestion(i)}>
                Remove
              </button>
            </div>
            {q.options.map((option, optIndex) => (
              <div key={optIndex} className="flex-row mt-2">
                <input
                  type="radio"
                  name={`correct-${chapter.id}-${i}`}
                  checked={q.correctIndex === optIndex}
                  onChange={() => updateQuestion(i, { correctIndex: optIndex })}
                  aria-label={`Mark option ${optIndex + 1} correct`}
                />
                <input
                  className="flex-1"
                  placeholder={`Option ${optIndex + 1}`}
                  value={option}
                  onChange={(e) => updateOption(i, optIndex, e.target.value)}
                />
              </div>
            ))}
            <input
              className="mt-2"
              placeholder="Topic (e.g. 'Colonial history')"
              value={q.topic}
              onChange={(e) => updateQuestion(i, { topic: e.target.value })}
            />
          </div>
        ))}
        <div className="flex-row mt-2">
          <button className="btn-secondary btn-sm" disabled={busy} onClick={addQuestion}>
            Add question
          </button>
          <button
            className={chapter.quiz ? "btn-success btn-sm" : "btn-sm"}
            disabled={busy || !quizValid}
            onClick={handleSaveQuiz}
          >
            {chapter.quiz ? "✓ Quiz saved" : "Save quiz"}
          </button>
        </div>
      </div>
    </li>
  );
}
