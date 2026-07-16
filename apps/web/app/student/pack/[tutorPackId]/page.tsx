"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ChapterSummary } from "../../../../lib/api";
import { useSession } from "../../../../lib/session";

export default function StudentPackPage({ params }: { params: { tutorPackId: string } }) {
  const { userId, me, loading: sessionLoading } = useSession();
  const [pack, setPack] = useState<{ title: string; chapters: ChapterSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId && me?.role === "STUDENT") {
      api
        .getPackChapters(userId, params.tutorPackId)
        .then(setPack)
        .catch((err) => setError(String(err)));
    }
  }, [userId, me, params.tutorPackId]);

  if (!userId) return <p className="state-page">Sign in on the home page first.</p>;
  if (sessionLoading) return <p className="state-page">Loading...</p>;
  if (me?.role !== "STUDENT") return <p className="state-page">This dashboard is for students only.</p>;
  if (error) return <p className="alert alert-error">{error}</p>;
  if (!pack) return <p className="state-page">Loading...</p>;

  return (
    <div className="card">
      <h2>{pack.title}</h2>
      <ul className="plain">
        {pack.chapters.map((chapter) => (
          <li key={chapter.id} className="list-item">
            <Link href={`/student/${chapter.id}`} className="list-link">
              {chapter.title}
            </Link>
            <div className="card-meta" style={{ marginTop: 6, marginBottom: 0 }}>
              {chapter.summary && <span className="badge badge-published">Summary</span>}
              {chapter.quiz && <span className="badge badge-published">Quiz</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
