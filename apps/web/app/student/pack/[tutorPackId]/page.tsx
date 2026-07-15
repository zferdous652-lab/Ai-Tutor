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

  if (!userId) return <p>Sign in on the home page first.</p>;
  if (sessionLoading) return <p>Loading...</p>;
  if (me?.role !== "STUDENT") return <p>This dashboard is for students only.</p>;
  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (!pack) return <p>Loading...</p>;

  return (
    <div className="card">
      <h2>{pack.title}</h2>
      <ul>
        {pack.chapters.map((chapter) => (
          <li key={chapter.id}>
            <Link href={`/student/${chapter.id}`}>{chapter.title}</Link>{" "}
            {chapter.summary ? "✅ summary" : ""} {chapter.quiz ? "✅ quiz" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
