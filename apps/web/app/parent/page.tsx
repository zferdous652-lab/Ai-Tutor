"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";

type Dashboard = Awaited<ReturnType<typeof api.getParentDashboard>>;

export default function ParentDashboardPage() {
  const { userId } = useSession();
  const { t } = useI18n();
  const [dashboard, setDashboard] = useState<Dashboard>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    api.getParentDashboard(userId).then(setDashboard).catch((err) => setError(String(err)));
  }, [userId]);

  if (!userId) return <p>Sign in on the home page first.</p>;
  if (error) return <p style={{ color: "crimson" }}>{error}</p>;

  return (
    <div>
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
