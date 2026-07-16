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
    <div className="auth-card">
      <span className="eyebrow">Phase 1 Prototype</span>
      <h1>MYTAMAN AI Tutor</h1>
      <p className="text-muted">
        This is the internal prototype: there is no real login yet. Run{" "}
        <code>npm run db:seed --workspace apps/api</code> once, then paste one of the printed
        <strong> Admin</strong>, <strong>Parent</strong>, or <strong>Student</strong> user ids
        below to act as that user.
      </p>
      {userId ? (
        <div className="flex-row mt-4">
          <p className="text-sm" style={{ margin: 0 }}>
            {loading ? "Signing in..." : `Signed in as user id ${userId}.`}
          </p>
          <button className="btn-secondary btn-sm" onClick={() => setUserId(null)}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="field mt-4">
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
      <div className="role-grid">
        <div className="role-card">
          <strong>Admin</strong>
          <span>Builds and publishes Tutor Packs from the Admin dashboard.</span>
        </div>
        <div className="role-card">
          <strong>Parent</strong>
          <span>Browses published Tutor Packs, enrolls their child, and tracks progress.</span>
        </div>
        <div className="role-card">
          <strong>Student</strong>
          <span>Works through the Tutor Packs they&apos;re enrolled in.</span>
        </div>
      </div>
    </div>
  );
}
