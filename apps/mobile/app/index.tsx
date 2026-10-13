import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/auth";
import { LoadingView } from "../src/components/ui";

/**
 * Role router: unauthenticated -> /login,
 * STUDENT -> /(student), TEACHER -> /(teacher).
 */
export default function Index() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  if (!isHydrated) return <LoadingView message="Opening SchoolSphere…" />;
  if (!user || !role) return <Redirect href="/login" />;
  if (role === "TEACHER") return <Redirect href="/(teacher)" />;
  return <Redirect href="/(student)" />;
}
