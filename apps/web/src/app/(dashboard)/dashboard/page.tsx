"use client";

import { useQuery } from "@tanstack/react-query";
import {
  School,
  Users,
  GraduationCap,
  UserCheck,
  Wallet,
  Database,
  CalendarCheck,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/components/language-provider";
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/page-skeleton";

// Lazy-load heavy recharts sections so the initial dashboard chunk stays
// light; each chart streams in with a skeleton fallback (no SSR for charts).
const RevenueChart = dynamic(
  () => import("@/components/dashboard/charts").then((m) => m.RevenueChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const AttendanceChart = dynamic(
  () => import("@/components/dashboard/charts").then((m) => m.AttendanceChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const FeeMixChart = dynamic(
  () => import("@/components/dashboard/charts").then((m) => m.FeeMixChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-48" /> }
);
const GrowthChart = dynamic(
  () => import("@/components/dashboard/charts").then((m) => m.GrowthChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-56" /> }
);

const studentGrowth = [
  { month: "Jan", students: 420 },
  { month: "Feb", students: 460 },
  { month: "Mar", students: 505 },
  { month: "Apr", students: 560 },
  { month: "May", students: 615 },
  { month: "Jun", students: 680 },
  { month: "Jul", students: 720 },
];

const revenueData = [
  { month: "Jan", revenue: 450000 },
  { month: "Feb", revenue: 520000 },
  { month: "Mar", revenue: 480000 },
  { month: "Apr", revenue: 690000 },
  { month: "May", revenue: 720000 },
  { month: "Jun", revenue: 840000 },
  { month: "Jul", revenue: 910000 },
];

const attendanceData = [
  { month: "Jan", rate: 92 },
  { month: "Feb", rate: 94 },
  { month: "Mar", rate: 91 },
  { month: "Apr", rate: 95 },
  { month: "May", rate: 93 },
  { month: "Jun", rate: 96 },
  { month: "Jul", rate: 94 },
];

const feeStatusData = [
  { name: "Paid", value: 65 },
  { name: "Partial", value: 15 },
  { name: "Pending", value: 20 },
];

const PIE_COLORS = ["#1a7a1a", "#f59e0b", "#ef4444"];

const recentSchools = [
  { name: "Greenfield International School", code: "GIS001", students: 120, status: "ACTIVE" },
  { name: "Riverside Public School", code: "RPS001", students: 85, status: "ACTIVE" },
  { name: "Sunrise Academy", code: "SRA001", students: 64, status: "ACTIVE" },
  { name: "Hillcrest International", code: "HSI001", students: 98, status: "TRIAL" },
];

export default function DashboardPage() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.isSuperAdmin;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await api.get("/schools/dashboard");
      return response.data.data;
    },
  });

  if (isLoading) {
    return <LoadingState label={t("dashboard.loading")} />;
  }

  if (isError) {
    return (
      <ErrorState
        message={t("toast.failed")}
        onRetry={() => refetch()}
      />
    );
  }

  const stats = data || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          {isSuperAdmin ? t("dashboard.titlePlatform") : t("dashboard.titleSchool")}
        </h1>
        <p className="text-sm text-slate-500">
          {t("dashboard.welcome")}{" "}
          {isSuperAdmin ? t("dashboard.welcomeSuper") : t("dashboard.welcomeSchool")}{" "}
          {t("dashboard.welcomeDay")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={isSuperAdmin ? t("dashboard.totalSchools") : t("dashboard.school")}
          value={String(stats.totalSchools || 0)}
          change={isSuperAdmin ? t("dashboard.thisMonth", { n: 1 }) : undefined}
          icon={<School className="h-5 w-5" />}
          iconBg="bg-primary-50 text-primary-600"
        />
        <StatCard
          title={t("dashboard.totalStudents")}
          value={String(stats.totalStudents || 0)}
          change={t("dashboard.thisMonth", { n: 24 })}
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-600"
        />
        <StatCard
          title={t("dashboard.teachersStaff")}
          value={String((stats.totalTeachers || 0) + (stats.totalStaff || 0))}
          change={t("dashboard.thisMonth", { n: 4 })}
          icon={<UserCheck className="h-5 w-5" />}
          iconBg="bg-purple-50 text-purple-600"
        />
        <StatCard
          title={t("dashboard.pendingFees")}
          value={`₹${Number(stats.pendingFees || 0).toLocaleString()}`}
          change={t("dashboard.invoicesDue", { n: 14 })}
          icon={<Wallet className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary-600" />
              {t("dashboard.revenue")}
            </CardTitle>
            <CardDescription>{t("dashboard.revenueDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <RevenueChart data={revenueData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.attendanceRate")}</CardTitle>
            <CardDescription>{t("dashboard.attendanceDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <AttendanceChart data={attendanceData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("dashboard.recentSchools")}</CardTitle>
              <CardDescription>{t("dashboard.recentSchoolsDesc")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dashboard.school")}</TableHead>
                  <TableHead>{t("common.code")}</TableHead>
                  <TableHead>{t("dashboard.totalStudents")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSchools.map((school) => (
                  <TableRow key={school.code}>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell className="text-slate-500">{school.code}</TableCell>
                    <TableCell>{school.students}</TableCell>
                    <TableCell>
                      <Badge variant={school.status === "ACTIVE" ? "success" : "warning"}>
                        {school.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.feeCollection")}</CardTitle>
            <CardDescription>{t("dashboard.feeCollectionDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <FeeMixChart data={feeStatusData} colors={PIE_COLORS} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {feeStatusData.map((item, index) => (
                <div key={item.name}>
                  <div
                    className="mx-auto mb-1 h-2 w-8 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[index] }}
                  />
                  <p className="text-xs text-slate-500">{item.name}</p>
                  <p className="text-sm font-semibold">{item.value}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-600" />
              {t("dashboard.studentGrowth")}
            </CardTitle>
            <CardDescription>{t("dashboard.studentGrowthDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <GrowthChart data={studentGrowth} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-primary-600" />
                {t("dashboard.quickActions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {[
                { label: t("dashboard.admitStudent"), icon: GraduationCap },
                { label: t("dashboard.recordAttendance"), icon: CalendarCheck },
                { label: t("dashboard.createInvoice"), icon: Database },
                { label: t("dashboard.publishResult"), icon: TrendingUp },
              ].map((action) => (
                <button
                  key={action.label}
                  className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-primary-300 hover:bg-primary-50"
                >
                  <action.icon className="h-5 w-5 text-primary-600" />
                  <span className="text-sm font-medium text-slate-700">
                    {action.label}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}