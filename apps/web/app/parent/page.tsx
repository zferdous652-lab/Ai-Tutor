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

  if (!userId) return <p className="state-page">Sign in on the home page first.</p>;
  if (sessionLoading) return <p className="state-page">Loading...</p>;
  if (me?.role !== "PARENT") return <p className="state-page">This dashboard is for parents only.</p>;

  const isEnrolled = (studentId: string, tutorPackId: string) =>
    enrollments.some((e) => e.studentId === studentId && e.tutorPackId === tutorPackId);

  return (
    <div>
      <div className="page-header">
        <h1>Parent dashboard</h1>
        <p>Browse Tutor Packs, enroll your child, and track their progress.</p>
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      <div className="card">
        <h2>Available Tutor Packs</h2>
        {packs.length === 0 && (
          <div className="empty-state">No Tutor Packs published yet — check back soon.</div>
        )}
        <ul className="plain">
          {packs.map((pack) => (
            <li key={pack.id} className="list-item">
              <div className="card-meta" style={{ marginBottom: 6 }}>
                <strong style={{ color: "var(--color-text)" }}>{pack.title}</strong>
                <span className={`badge badge-${pack.tier.toLowerCase()}`}>{pack.tier}</span>
                <span className="dot">·</span>
                <span>{pack.subject}</span>
                <span className="dot">·</span>
                <span>{pack.standard}</span>
              </div>
              <div className="flex-row" style={{ flexWrap: "wrap" }}>
                {dashboard.map((student) => (
                  <button
                    key={student.studentId}
                    className="btn-secondary btn-sm"
                    disabled={busy || isEnrolled(student.studentId, pack.id)}
                    onClick={() => handleEnroll(student.studentId, pack.id)}
                  >
                    {isEnrolled(student.studentId, pack.id)
                      ? `${student.studentName} enrolled`
                      : `Enroll ${student.studentName}`}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {dashboard.map((student) => (
        <div key={student.studentId} className="card">
          <div className="card-header">
            <h2 style={{ margin: 0 }}>{student.studentName}</h2>
            <span className="badge badge-premium">
              {t("parent.xpoints")}: {student.xpointsBalance}
            </span>
          </div>
          <h3 className="mt-4">{t("parent.weakChapters")}</h3>
          {student.weakestChapters.length === 0 ? (
            <div className="empty-state">{t("parent.noWeakChapters")}</div>
          ) : (
            <ul className="plain">
              {student.weakestChapters.map((c) => (
                <li key={c.chapterId} className="list-item list-item-row">
                  <span className="flex-1">{c.chapterTitle}</span>
                  <span className="badge">{Math.round(c.latestScore * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
