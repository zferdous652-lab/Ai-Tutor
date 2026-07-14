"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, DocumentDto } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";

export default function UploadPage() {
  const { userId } = useSession();
  const { t } = useI18n();
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!userId) return;
    setDocuments(await api.listDocuments(userId));
  }

  useEffect(() => {
    refresh().catch((err) => setError(String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget);
      await api.uploadDocument(userId, form);
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
      if (kind === "summary") await api.generateSummary(userId, chapterId);
      else await api.generateQuiz(userId, chapterId);
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!userId) {
    return <p>Sign in on the home page first.</p>;
  }

  return (
    <div>
      <div className="card">
        <h2>{t("upload.title")}</h2>
        <form onSubmit={handleUpload}>
          <div className="field">
            <label htmlFor="title">{t("upload.titleField")}</label>
            <input id="title" name="title" required placeholder="Form 1 Sejarah" />
          </div>
          <div className="field">
            <label htmlFor="subject">{t("upload.subjectField")}</label>
            <input id="subject" name="subject" defaultValue="Sejarah" />
          </div>
          <div className="field">
            <label htmlFor="standard">{t("upload.standardField")}</label>
            <input id="standard" name="standard" defaultValue="KSSM" />
          </div>
          <div className="field">
            <label htmlFor="file">PDF</label>
            <input id="file" name="file" type="file" accept="application/pdf" required />
          </div>
          <button type="submit" disabled={busy}>
            {busy ? t("upload.processing") : t("upload.submit")}
          </button>
        </form>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {documents.map((doc) => (
        <div key={doc.id} className="card">
          <h3>
            {doc.title} — {doc.status}
          </h3>
          <p>
            {doc.subject} · {doc.standard} · {doc.chapters.length} {t("documents.chapters")}
          </p>
          <ul>
            {doc.chapters.map((chapter) => (
              <li key={chapter.id} style={{ marginBottom: 8 }}>
                <Link href={`/student/${chapter.id}`}>{chapter.title}</Link>{" "}
                {chapter.summary ? "✅ summarized" : ""}
                <div>
                  <button disabled={busy} onClick={() => handleGenerate("summary", chapter.id)}>
                    {t("documents.generateSummary")}
                  </button>{" "}
                  <button disabled={busy} onClick={() => handleGenerate("quiz", chapter.id)}>
                    {t("documents.generateQuiz")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
