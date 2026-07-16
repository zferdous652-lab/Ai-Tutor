"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ChapterAdminDetail, TutorPackAdminDetailView } from "../../../../../lib/api";
import { useSession } from "../../../../../lib/session";

export default function ReviewPackPage({ params }: { params: { tutorPackId: string } }) {
  const { userId, me, loading: sessionLoading } = useSession();
  const [pack, setPack] = useState<TutorPackAdminDetailView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId && me?.role === "ADMIN") {
      api
        .adminGetPack(userId, params.tutorPackId)
        .then(setPack)
        .catch((err) => setError(String(err)));
    }
  }, [userId, me, params.tutorPackId]);

  if (!userId) return <p className="state-page">Sign in on the home page first.</p>;
  if (sessionLoading) return <p className="state-page">Loading...</p>;
  if (me?.role !== "ADMIN") return <p className="state-page">This dashboard is for admins only.</p>;
  if (error) return <p className="alert alert-error">{error}</p>;
  if (!pack) return <p className="state-page">Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <Link href="/admin" className="btn-ghost btn-sm">
          ← Back to Admin Dashboard
        </Link>
        <h1 className="mt-2">{pack.title}</h1>
        <div className="card-meta">
          <span className={`badge badge-${pack.status.toLowerCase()}`}>{pack.status}</span>
          <span className={`badge ${pack.publishedAt ? "badge-published" : "badge-draft"}`}>
            {pack.publishedAt ? "Published" : "Draft"}
          </span>
          <span className={`badge badge-${pack.tier.toLowerCase()}`}>{pack.tier}</span>
          <span className="dot">·</span>
          <span>{pack.subject}</span>
          <span className="dot">·</span>
          <span>{pack.standard}</span>
        </div>
        <p>Review what the AI generated for each chapter before publishing this pack to students.</p>
      </div>

      {pack.visualNotes && pack.visualNotes.length > 0 && (
        <div className="card">
          <h2>Captioned figures</h2>
          <p className="field-hint" style={{ marginTop: 0 }}>
            Diagrams/maps/photos found across the whole PDF — not attributed to a specific chapter.
          </p>
          <ul className="plain">
            {pack.visualNotes.map((note, i) => (
              <li key={i} className="list-item">
                <span className="badge">Page {note.page}</span> {note.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pack.chapters.length === 0 && (
        <div className="empty-state">No chapters were detected in this pack.</div>
      )}

      {pack.chapters.map((chapter) => (
        <ChapterReview key={chapter.id} chapter={chapter} />
      ))}
    </div>
  );
}

function ChapterReview({ chapter }: { chapter: ChapterAdminDetail }) {
  return (
    <div className="card">
      <h2>{chapter.title}</h2>

      <h3 className="mt-4">Summary</h3>
      {chapter.summary ? (
        <p style={{ whiteSpace: "pre-wrap" }}>{chapter.summary}</p>
      ) : (
        <div className="empty-state">Not generated yet — use &quot;Generate summary&quot; on the dashboard.</div>
      )}

      <h3 className="mt-4">Quiz</h3>
      {chapter.quiz ? (
        <ol className="plain" style={{ listStyle: "decimal", paddingLeft: 20 }}>
          {chapter.quiz.questions.map((q, i) => (
            <li key={i} className="mt-2">
              <div>
                <strong>{q.question}</strong> <span className="badge">{q.topic}</span>
              </div>
              <ul className="plain mt-2">
                {q.options.map((option, optIndex) => (
                  <li
                    key={optIndex}
                    className="list-item"
                    style={
                      optIndex === q.correctIndex
                        ? { borderColor: "var(--color-success, #22c55e)" }
                        : undefined
                    }
                  >
                    {option}
                    {optIndex === q.correctIndex && (
                      <span className="badge badge-published" style={{ marginLeft: 8 }}>
                        Correct
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty-state">Not generated yet — use &quot;Generate quiz&quot; on the dashboard.</div>
      )}

      <details className="mt-4">
        <summary style={{ cursor: "pointer", color: "var(--color-text-muted)" }}>
          View extracted source text
        </summary>
        <p className="field-hint" style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
          {chapter.content}
        </p>
      </details>
    </div>
  );
}
