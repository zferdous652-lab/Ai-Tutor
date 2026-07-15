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

  if (!userId) return <p>Sign in on the home page first.</p>;
  if (sessionLoading) return <p>Loading...</p>;
  if (me?.role !== "STUDENT") return <p>This dashboard is for students only.</p>;
  if (error) return <p style={{ color: "crimson" }}>{error}</p>;

  return (
    <div className="card">
      <h2>My Tutor Packs</h2>
      {enrollments.length === 0 && (
        <p>You&apos;re not enrolled in any Tutor Packs yet — ask a parent to enroll you.</p>
      )}
      <ul>
        {enrollments.map((e) => (
          <li key={e.id}>
            <Link href={`/student/pack/${e.tutorPack.id}`}>{e.tutorPack.title}</Link> —{" "}
            {e.tutorPack.subject} · {e.tutorPack.standard}
          </li>
        ))}
      </ul>
    </div>
  );
}
