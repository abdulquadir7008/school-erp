"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/stores/auth-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

// Deferred: only mounts when user opens search (Ctrl+K), keeps the
// initial dashboard chunk light.
const GlobalSearchModal = dynamic(
  () =>
    import("@/components/layout/global-search-modal").then(
      (m) => m.GlobalSearchModal
    ),
  { ssr: false }
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="ps-64 transition-all duration-300">
        <Topbar />
        <main className="p-6">
          {children}
          <GlobalSearchModal />
        </main>
      </div>
    </div>
  );
}