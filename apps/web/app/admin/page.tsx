import { redirect } from "next/navigation";

// The Admin Dashboard is now split into two content-creation modes (see the sidebar in
// app/admin/(content)/layout.tsx) — this bare /admin route just lands on the default one.
export default function AdminIndexPage() {
  redirect("/admin/generate");
}
