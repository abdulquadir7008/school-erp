import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md space-y-4 p-6">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        <PageSkeleton rows={3} />
      </div>
    </div>
  );
}
