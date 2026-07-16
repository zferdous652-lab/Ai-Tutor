"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Enrollment } from "../../lib/api";
import { useSession } from "../../lib/session";

export default function StudentHomePage() {
  const { userId, me, loading: sessionLoading } = useSession();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId && me?.role === "STUDENT") {
      api.listEnrollments(userId).then(setEnrollments).catch((err) => setError(String(err)));
    }
  }, [userId, me]);

  if (!userId) return <p className="state-page">Sign in on the home page first.</p>;
  if (sessionLoading) return <p className="state-page">Loading...</p>;
  if (me?.role !== "STUDENT") return <p className="state-page">This dashboard is for students only.</p>;
  if (error) return <p className="alert alert-error">{error}</p>;

  return (
    <div>
      <div className="page-header">
        <h1>My Tutor Packs</h1>
        <p>Pick a pack to read summaries, take quizzes, and chat with your AI tutor.</p>
      </div>
      <div className="card">
        {enrollments.length === 0 && (
          <div className="empty-state">
            You&apos;re not enrolled in any Tutor Packs yet — ask a parent to enroll you.
          </div>
        )}
        <ul className="plain">
          {enrollments.map((e) => (
            <li key={e.id} className="list-item">
              <Link href={`/student/pack/${e.tutorPack.id}`} className="list-link">
                {e.tutorPack.title}
              </Link>
              <div className="text-muted text-sm mt-2">
                {e.tutorPack.subject} · {e.tutorPack.standard}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
