"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  CalendarDays,
  BookOpen,
  Target,
  Loader2,
  Plus,
  Search,
  BarChart3,
  CheckCircle2,
  Timer,
  CalendarClock,
  Trophy,
  CircleCheckBig,
  CircleX,
  Zap,
  Pencil,
  Play,
  Send,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/components/language-provider";

interface ExamSubject {
  id: string;
  subjectId: string;
  maxMarks: number;
  passMarks: number;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  subject: { id: string; name: string; code?: string };
}

interface Exam {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "PUBLISHED";
  subjects: ExamSubject[];
  createdAt: string;
}

interface ExamDashboardStats {
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  published: number;
  nextExam: Exam | null;
  upcomingExams: Exam[];
  recentResults: Exam[];
}

type ExamTab = "all" | "scheduled" | "in_progress" | "completed" | "published";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; labelKey: string }> = {
  DRAFT: { color: "text-slate-600", bg: "bg-slate-100", icon: <Pencil className="h-3.5 w-3.5" />, labelKey: "exams.statusDraft" },
  SCHEDULED: { color: "text-blue-700", bg: "bg-blue-100", icon: <CalendarClock className="h-3.5 w-3.5" />, labelKey: "exams.statusUpcoming" },
  IN_PROGRESS: { color: "text-amber-700", bg: "bg-amber-100", icon: <Play className="h-3.5 w-3.5" />, labelKey: "exams.statusOngoing" },
  COMPLETED: { color: "text-purple-700", bg: "bg-purple-100", icon: <CheckCircle2 className="h-3.5 w-3.5" />, labelKey: "exams.statusCompleted" },
  PUBLISHED: { color: "text-green-700", bg: "bg-green-100", icon: <Trophy className="h-3.5 w-3.5" />, labelKey: "exams.statusPublished" },
};

const tabConfig: { key: ExamTab; labelKey: string }[] = [
  { key: "all", labelKey: "exams.tabAll" },
  { key: "scheduled", labelKey: "exams.tabUpcoming" },
  { key: "in_progress", labelKey: "exams.tabOngoing" },
  { key: "completed", labelKey: "exams.tabCompleted" },
  { key: "published", labelKey: "exams.tabResults" },
];

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

function getTimeLeft(targetDate: string) {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(d: string, t: Translate) {
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return t("exams.daysAgo", { count: Math.abs(diff) });
  if (diff === 0) return t("exams.today");
  if (diff === 1) return t("exams.tomorrow");
  return t("exams.inDays", { count: diff });
}

function durationLabel(start: string, end: string, t: Translate) {
  const diff = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (diff <= 1) return t("exams.durationDay");
  return t("exams.durationDays", { count: diff });
}

function totalMaxMarks(subjects: ExamSubject[]) {
  return subjects.reduce((sum, s) => sum + s.maxMarks, 0);
}

export default function ExamsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";
  const canManage = isSuperAdmin || user?.roleName === "SCHOOL_ADMIN" || user?.roleName === "PRINCIPAL";

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ExamTab>("all");
  const [showResults, setShowResults] = useState<string | null>(null);

  const schoolId = isSuperAdmin ? "" : user?.schoolId || "";

  const statsQuery = useQuery({
    queryKey: ["exams-dashboard", schoolId],
    queryFn: async () => {
      const res = await api.get("/exams/dashboard", {
        params: schoolId ? { schoolId } : {},
      });
      return res.data.data as ExamDashboardStats;
    },
  });

  const examsQuery = useQuery({
    queryKey: ["exams-list", search, activeTab, schoolId],
    queryFn: async () => {
      const params: any = { limit: 50 };
      if (search) params.search = search;
      if (activeTab !== "all") params.status = activeTab.toUpperCase();
      if (schoolId) params.schoolId = schoolId;
      const res = await api.get("/exams", { params });
      return res.data.data as Exam[];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/exams/${id}/status`, { status });
    },
    onSuccess: () => {
      toast.success(t("exams.statusUpdated"));
      queryClient.invalidateQueries({ queryKey: ["exams-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["exams-list"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resultsQuery = useQuery({
    queryKey: ["exam-results", showResults],
    queryFn: async () => {
      const res = await api.get(`/exams/${showResults}/results`);
      return res.data.data;
    },
    enabled: !!showResults,
  });

  const stats = statsQuery.data;
  const exams = examsQuery.data || [];
  const nextExam = stats?.nextExam;
  const countdown = useCountdown(nextExam?.startDate || new Date().toISOString());

  const filteredExams = useMemo(() => {
    if (activeTab === "all") return exams;
    return exams.filter((e) => e.status === activeTab.toUpperCase());
  }, [exams, activeTab]);

  const tabCounts = useMemo(() => {
    const counts: Record<ExamTab, number> = { all: exams.length, scheduled: 0, in_progress: 0, completed: 0, published: 0 };
    exams.forEach((e) => {
      const key = e.status.toLowerCase() as ExamTab;
      if (key in counts) counts[key]++;
    });
    return counts;
  }, [exams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("nav.exams")}</h1>
          <p className="text-sm text-slate-500">{t("exams.subtitle")}</p>
        </div>
        {canManage && (
          <Button>
            <Plus className="ms-2 h-4 w-4" />
            {t("exams.createExam")}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("exams.statTotal")}
          value={String(stats?.total ?? 0)}
          icon={<FileText className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-600"
        />
        <StatCard
          title={t("exams.statScheduled")}
          value={String(stats?.scheduled ?? 0)}
          change={nextExam ? t("exams.statNextExam", { name: nextExam.name }) : undefined}
          icon={<CalendarClock className="h-5 w-5" />}
          iconBg="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          title={t("exams.statInProgress")}
          value={String(stats?.inProgress ?? 0)}
          icon={<Timer className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-600"
        />
        <StatCard
          title={t("exams.statPublished")}
          value={String(stats?.published ?? 0)}
          icon={<Trophy className="h-5 w-5" />}
          iconBg="bg-green-50 text-green-600"
        />
      </div>

      {/* Next Exam Banner */}
      {nextExam && (
        <Card className="relative overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <div className="absolute end-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-blue-100/50" />
          <div className="absolute end-16 bottom-0 h-20 w-20 translate-y-6 rounded-full bg-indigo-100/40" />
          <CardContent className="relative p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Zap className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">{t("exams.nextExam")}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{nextExam.name}</h2>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    {formatDate(nextExam.startDate)} — {formatDate(nextExam.endDate)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-slate-400" />
                    {nextExam.subjects.length} {t(nextExam.subjects.length !== 1 ? "exams.subjects" : "exams.subject")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-slate-400" />
                    {t("exams.marksCount", { count: totalMaxMarks(nextExam.subjects) })}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{daysUntil(nextExam.startDate, t)}</p>
              </div>
              <div className="flex gap-3">
                <CountdownBlock value={countdown.days} label={t("exams.countdownDays")} />
                <CountdownBlock value={countdown.hours} label={t("exams.countdownHours")} />
                <CountdownBlock value={countdown.minutes} label={t("exams.countdownMin")} />
                <CountdownBlock value={countdown.seconds} label={t("exams.countdownSec")} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {tabConfig.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {t(tab.labelKey)}
            <span
              className={`ms-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                activeTab === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="ps-9"
          placeholder={t("exams.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Exam Cards */}
      {examsQuery.isLoading ? (
        <LoadingState label={t("exams.loadingExams")} />
      ) : examsQuery.isError ? (
        <ErrorState message={t("exams.loadFailed")} onRetry={() => examsQuery.refetch()} />
      ) : filteredExams.length === 0 ? (
        <EmptyState
          title={t("exams.noExams")}
          description={search ? t("exams.tryDifferentSearch") : t("exams.createFirstExam")}
          action={canManage ? <Button><Plus className="ms-2 h-4 w-4" />{t("exams.createExam")}</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredExams.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              canManage={canManage}
              onStatusChange={(status) => statusMutation.mutate({ id: exam.id, status })}
              onViewResults={() => setShowResults(exam.id)}
              isPending={statusMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Results Modal */}
      {showResults && resultsQuery.data && (
        <ResultsModal
          data={resultsQuery.data}
          onClose={() => {
            setShowResults(null);
          }}
        />
      )}
    </div>
  );
}

function CountdownBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-14 w-16 items-center justify-center rounded-xl bg-slate-900 font-mono text-2xl font-bold text-white shadow-lg">
        {String(value).padStart(2, "0")}
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  );
}

function ExamCard({
  exam,
  canManage,
  onStatusChange,
  onViewResults,
  isPending,
}: {
  exam: Exam;
  canManage: boolean;
  onStatusChange: (status: string) => void;
  onViewResults: () => void;
  isPending: boolean;
}) {
  const { t } = useI18n();
  const cfg = statusConfig[exam.status] || statusConfig.DRAFT;

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/50">
      <div className={`absolute inset-x-0 top-0 h-1 ${cfg.bg}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant={exam.status === "PUBLISHED" ? "success" : exam.status === "IN_PROGRESS" ? "warning" : "secondary"} className="shrink-0">
                {cfg.icon}
                <span className="ms-1">{t(cfg.labelKey)}</span>
              </Badge>
              <span className="text-[11px] font-medium text-slate-400">{exam.type}</span>
            </div>
            <h3 className="mt-2 text-base font-semibold text-slate-900 truncate">{exam.name}</h3>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            <span>{formatDateShort(exam.startDate)} — {formatDateShort(exam.endDate)}</span>
            <span className="text-xs text-slate-400">({durationLabel(exam.startDate, exam.endDate, t)})</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-slate-400" />
            <span>{exam.subjects.length} {t(exam.subjects.length !== 1 ? "exams.subjects" : "exams.subject")}</span>
            <span className="text-xs text-slate-400">· {t("exams.marksTotal", { count: totalMaxMarks(exam.subjects) })}</span>
          </div>
        </div>

        {/* Subject pills */}
        <div className="mt-3 flex flex-wrap gap-1">
          {exam.subjects.slice(0, 4).map((es) => (
            <span
              key={es.id}
              className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
            >
              {es.subject.name}
            </span>
          ))}
          {exam.subjects.length > 4 && (
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {t("exams.moreCount", { count: exam.subjects.length - 4 })}
            </span>
          )}
        </div>

        {/* Schedule details */}
        {exam.subjects.some((s) => s.date) && (
          <div className="mt-3 rounded-lg bg-slate-50 p-2.5">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t("exams.schedule")}</p>
            <div className="space-y-1">
              {exam.subjects.filter((s) => s.date).slice(0, 3).map((es) => (
                <div key={es.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{es.subject.name}</span>
                  <span className="text-slate-500">{formatDateShort(es.date)} {es.startTime || ""}{es.endTime ? `–${es.endTime}` : ""}</span>
                </div>
              ))}
              {exam.subjects.filter((s) => s.date).length > 3 && (
                <p className="text-[10px] text-slate-400">{t("exams.moreCount", { count: exam.subjects.filter((s) => s.date).length - 3 })}</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {exam.status === "SCHEDULED" && canManage && (
            <Button size="sm" onClick={() => onStatusChange("IN_PROGRESS")}>
              {isPending ? <Loader2 className="ms-1 h-3.5 w-3.5 animate-spin" /> : <Play className="ms-1 h-3.5 w-3.5" />}
              {t("exams.startExam")}
            </Button>
          )}
          {exam.status === "IN_PROGRESS" && canManage && (
            <Button size="sm" onClick={() => onStatusChange("COMPLETED")}>
              {isPending ? <Loader2 className="ms-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="ms-1 h-3.5 w-3.5" />}
              {t("exams.markComplete")}
            </Button>
          )}
          {exam.status === "COMPLETED" && canManage && (
            <Button size="sm" onClick={() => onStatusChange("PUBLISHED")}>
              {isPending ? <Loader2 className="ms-1 h-3.5 w-3.5 animate-spin" /> : <Send className="ms-1 h-3.5 w-3.5" />}
              {t("exams.publishResults")}
            </Button>
          )}
          {exam.status === "PUBLISHED" && (
            <Button size="sm" variant="outline" onClick={onViewResults}>
              <Trophy className="ms-1 h-3.5 w-3.5" />
              {t("exams.viewResults")}
            </Button>
          )}
          {(exam.status === "DRAFT" || exam.status === "SCHEDULED") && canManage && (
            <Button size="sm" variant="outline">
              <Pencil className="ms-1 h-3.5 w-3.5" />
              {t("common.edit")}
            </Button>
          )}
          {exam.status === "DRAFT" && canManage && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange("SCHEDULED")}>
              <CalendarClock className="ms-1 h-3.5 w-3.5" />
              {t("exams.scheduleAction")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsModal({ data, onClose }: { data: any; onClose: () => void }) {
  const { t } = useI18n();
  const summary = data?.summary;
  const students = data?.students || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{data?.exam?.name || t("exams.resultsTitle")}</h2>
            <p className="text-sm text-slate-500">{t("exams.performanceSummary")}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(85vh - 140px)" }}>
          {/* Summary Cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs font-medium text-slate-500">{t("exams.summaryStudents")}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{summary?.totalStudents ?? 0}</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-xs font-medium text-green-600">{t("exams.summaryPassed")}</p>
              <p className="mt-1 text-2xl font-bold text-green-700">{summary?.passedCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-xs font-medium text-red-600">{t("exams.summaryFailed")}</p>
              <p className="mt-1 text-2xl font-bold text-red-700">{summary?.failedCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
              <p className="text-xs font-medium text-blue-600">{t("exams.summaryPassRate")}</p>
              <p className="mt-1 text-2xl font-bold text-blue-700">{summary?.passRate ?? 0}%</p>
            </div>
          </div>

          {/* Average Performance */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">{t("exams.avgPerformance")}</p>
                <p className="text-lg font-bold text-slate-900">{summary?.avgPercentage ?? 0}%</p>
              </div>
              <div className="ms-auto">
                <ProgressRing percentage={summary?.avgPercentage ?? 0} />
              </div>
            </div>
          </div>

          {/* Student Results Table */}
          {students.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>{t("exams.colStudent")}</TableHead>
                  <TableHead>{t("exams.colAdmissionNo")}</TableHead>
                  <TableHead className="text-center">{t("exams.colObtained")}</TableHead>
                  <TableHead className="text-center">{t("exams.colMax")}</TableHead>
                  <TableHead className="text-center">%</TableHead>
                  <TableHead>{t("exams.colGrade")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s: any, i: number) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-slate-500">{i + 1}</TableCell>
                    <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{s.admissionNumber}</TableCell>
                    <TableCell className="text-center font-medium">{s.totalObtained}</TableCell>
                    <TableCell className="text-center text-slate-500">{s.totalMax}</TableCell>
                    <TableCell className="text-center font-semibold">{s.percentage}%</TableCell>
                    <TableCell>
                      <Badge variant={s.percentage >= 60 ? "success" : s.percentage >= 40 ? "warning" : "danger"}>
                        {s.grade}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.passed ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                          <CircleCheckBig className="h-3.5 w-3.5" /> {t("exams.pass")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                          <CircleX className="h-3.5 w-3.5" /> {t("exams.fail")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">{t("exams.noMarksRecorded")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressRing({ percentage }: { percentage: number }) {
  const size = 44;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 80 ? "#16a34a" : percentage >= 60 ? "#2563eb" : percentage >= 40 ? "#d97706" : "#dc2626";

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
}