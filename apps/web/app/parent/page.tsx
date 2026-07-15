"use client";

import { useEffect, useState } from "react";
import { api, Enrollment, TutorPackBrowseView } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";

type Dashboard = Awaited<ReturnType<typeof api.getParentDashboard>>;

export default function ParentDashboardPage() {
  const { userId, me, loading: sessionLoading } = useSession();
  const { t } = useI18n();
  const [dashboard, setDashboard] = useState<Dashboard>([]);
  const [packs, setPacks] = useState<TutorPackBrowseView[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!userId) return;
    const [d, p, e] = await Promise.all([
      api.getParentDashboard(userId),
      api.browseTutorPacks(userId),
      api.listEnrollments(userId),
    ]);
    setDashboard(d);
    setPacks(p);
    setEnrollments(e);
  }

  useEffect(() => {
    if (me?.role === "PARENT") refresh().catch((err) => setError(String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, me]);

  async function handleEnroll(studentId: string, tutorPackId: string) {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      await api.createEnrollment(userId, studentId, tutorPackId);
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!userId) return <p>Sign in on the home page first.</p>;
  if (sessionLoading) return <p>Loading...</p>;
  if (me?.role !== "PARENT") return <p>This dashboard is for parents only.</p>;

  const isEnrolled = (studentId: string, tutorPackId: string) =>
    enrollments.some((e) => e.studentId === studentId && e.tutorPackId === tutorPackId);

  return (
    <div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div className="card">
        <h2>Available Tutor Packs</h2>
        {packs.length === 0 && <p>No Tutor Packs published yet — check back soon.</p>}
        {packs.map((pack) => (
          <div key={pack.id} style={{ marginBottom: 12 }}>
            <strong>{pack.title}</strong> — {pack.subject} · {pack.standard} · {pack.tier}
            <div>
              {dashboard.map((student) => (
                <button
                  key={student.studentId}
                  disabled={busy || isEnrolled(student.studentId, pack.id)}
                  onClick={() => handleEnroll(student.studentId, pack.id)}
                  style={{ marginRight: 8, marginTop: 4 }}
                >
                  {isEnrolled(student.studentId, pack.id)
                    ? `${student.studentName} enrolled`
                    : `Enroll ${student.studentName}`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {dashboard.map((student) => (
        <div key={student.studentId} className="card">
          <h2>{student.studentName}</h2>
          <p>
            {t("parent.xpoints")}: {student.xpointsBalance}
          </p>
          <h3>{t("parent.weakChapters")}</h3>
          {student.weakestChapters.length === 0 ? (
            <p>{t("parent.noWeakChapters")}</p>
          ) : (
            <ul>
              {student.weakestChapters.map((c) => (
                <li key={c.chapterId}>
                  {c.chapterTitle} — {Math.round(c.latestScore * 100)}%
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
