"use client";

import { useState } from "react";
import { useSession } from "../lib/session";

export default function HomePage() {
  const { userId, setUserId } = useSession();
  const [input, setInput] = useState("");

  return (
    <div className="card">
      <h1>MYTAMAN AI Tutor — Phase 1 Prototype</h1>
      <p>
        This is the internal prototype: there is no real login yet. Run{" "}
        <code>npm run db:seed --workspace apps/api</code> once, then paste the printed{" "}
        <strong>Parent</strong> or <strong>Student</strong> user id below to act as that user.
      </p>
      {userId ? (
        <p>
          Signed in as user id <code>{userId}</code>.{" "}
          <button onClick={() => setUserId(null)}>Sign out</button>
        </p>
      ) : (
        <div className="field">
          <label htmlFor="userId">Demo user id</label>
          <input
            id="userId"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="paste seeded user id"
          />
          <button onClick={() => setUserId(input.trim())} disabled={!input.trim()}>
            Continue
          </button>
        </div>
      )}
      <p>
        Parents: go to <strong>Upload</strong> to add a textbook and generate summaries/quizzes.
        <br />
        Parents: go to <strong>Parent Dashboard</strong> to see weak chapters and Xpoints usage.
        <br />
        Students: open a chapter link from a document&apos;s chapter list on the Upload page to
        chat with the tutor and take the quiz.
      </p>
    </div>
  );
}
