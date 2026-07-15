"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../lib/session";

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin",
  PARENT: "/parent",
  STUDENT: "/student",
};

export default function HomePage() {
  const { userId, me, loading, setUserId } = useSession();
  const [input, setInput] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (me) router.push(ROLE_HOME[me.role]);
  }, [me, router]);

  return (
    <div className="card">
      <h1>MYTAMAN AI Tutor — Phase 1 Prototype</h1>
      <p>
        This is the internal prototype: there is no real login yet. Run{" "}
        <code>npm run db:seed --workspace apps/api</code> once, then paste one of the printed
        <strong> Admin</strong>, <strong>Parent</strong>, or <strong>Student</strong> user ids
        below to act as that user.
      </p>
      {userId ? (
        <p>
          {loading ? "Signing in..." : `Signed in as user id ${userId}.`}{" "}
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
        <strong>Admins</strong> build and publish Tutor Packs from the Admin dashboard.
        <br />
        <strong>Parents</strong> browse published Tutor Packs, enroll their child, and track
        progress from the Parent Dashboard.
        <br />
        <strong>Students</strong> work through the Tutor Packs they&apos;re enrolled in from
        their dashboard.
      </p>
    </div>
  );
}
