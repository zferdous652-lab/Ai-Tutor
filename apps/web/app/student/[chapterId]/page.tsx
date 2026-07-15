"use client";

import { useEffect, useState } from "react";
import { api, ChapterDetail } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";

interface ChatEntry {
  id: string;
  role: string;
  content: string;
}

export default function StudentChapterPage({ params }: { params: { chapterId: string } }) {
  const { userId, me, loading: sessionLoading } = useSession();
  const { t } = useI18n();
  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; weakTopics: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || me?.role !== "STUDENT") return;
    api
      .getChapter(userId, params.chapterId)
      .then((c) => {
        setChapter(c);
        if (c.tutorPack.tier !== "BASIC") {
          api
            .getChatHistory(userId, params.chapterId)
            .then(setMessages)
            .catch(() => {});
        }
      })
      .catch((err) => setError(String(err)));
  }, [userId, me, params.chapterId]);

  async function sendMessage() {
    if (!userId || !input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { studentMessage, tutorMessage } = await api.sendChatMessage(
        userId,
        params.chapterId,
        input
      );
      setMessages((prev) => [...prev, studentMessage, tutorMessage]);
      setInput("");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitQuiz() {
    if (!userId || !chapter?.quiz) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.submitQuizAttempt(userId, chapter.quiz.id, answers));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!userId) return <p>Sign in on the home page first.</p>;
  if (sessionLoading) return <p>Loading...</p>;
  if (me?.role !== "STUDENT") return <p>This page is for students only.</p>;
  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (!chapter) return <p>Loading...</p>;

  return (
    <div>
      <div className="card">
        <h2>{chapter.title}</h2>
        {chapter.summary ? <p>{chapter.summary}</p> : <p>No summary generated yet.</p>}
      </div>

      {chapter.tutorPack.tier === "BASIC" ? (
        <div className="card">
          <h3>Ask the AI tutor</h3>
          <p>
            Live chat with the AI tutor is a Premium feature and isn&apos;t included in this
            Tutor Pack.
          </p>
        </div>
      ) : (
        <div className="card">
          <h3>Ask the AI tutor</h3>
          {messages.map((m) => (
            <div key={m.id} className={`chat-message ${m.role}`}>
              {m.content}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              style={{ flex: 1 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("student.chat.placeholder")}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button onClick={sendMessage} disabled={busy || !input.trim()}>
              {t("student.chat.send")}
            </button>
          </div>
        </div>
      )}

      {chapter.quiz && (
        <div className="card">
          <h3>Quiz</h3>
          {chapter.quiz.questions.map((q, qi) => (
            <div key={qi} style={{ marginBottom: 12 }}>
              <p>{q.question}</p>
              {q.options.map((option, oi) => (
                <label key={oi} style={{ display: "block" }}>
                  <input
                    type="radio"
                    name={`q${qi}`}
                    checked={answers[qi] === oi}
                    onChange={() =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[qi] = oi;
                        return next;
                      })
                    }
                  />{" "}
                  {option}
                </label>
              ))}
            </div>
          ))}
          <button onClick={submitQuiz} disabled={busy}>
            {t("student.quiz.submit")}
          </button>
          {result && (
            <p>
              {t("student.quiz.score")}: {Math.round(result.score * 100)}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}
