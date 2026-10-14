"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, Download, Loader2, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, getErrorMessage } from "@/lib/api";

export function ReportCard({ examId }: { examId: string }) {
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [downloading, setDownloading] = useState(false);

  const resultsQuery = useQuery({
    queryKey: ["exam-results", examId],
    queryFn: async () => {
      const res = await api.get(`/exams/${examId}/results`);
      return res.data.data;
    },
  });

  const cardQuery = useQuery({
    queryKey: ["report-card", examId, studentId],
    queryFn: async () => {
      const res = await api.get(`/exams/${examId}/report-card`, { params: { studentId } });
      return res.data.data;
    },
    enabled: !!studentId,
  });

  const students: any[] = (resultsQuery.data?.students || []).filter((s: any) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return `${s.firstName} ${s.lastName} ${s.admissionNumber}`.toLowerCase().includes(q);
  });

  const downloadPdf = async () => {
    if (!studentId) return;
    setDownloading(true);
    try {
      const res = await api.get(`/exams/${examId}/report-card`, {
        params: { studentId, format: "pdf" },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-card-${cardQuery.data?.student?.admissionNumber || studentId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  const card = cardQuery.data;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Students ({students.length})</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="ps-9" placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {resultsQuery.isLoading ? (
            <LoadingState />
          ) : resultsQuery.isError ? (
            <ErrorState message="Failed to load results" onRetry={() => resultsQuery.refetch()} />
          ) : students.length === 0 ? (
            <EmptyState title="No results" description="Publish marks before generating report cards." />
          ) : (
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {students.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => setStudentId(s.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm hover:bg-slate-50 ${studentId === s.id ? "bg-primary-50 ring-1 ring-primary-200" : ""}`}
                >
                  <span className="font-medium">{s.firstName} {s.lastName} <span className="text-xs text-slate-500">{s.admissionNumber}</span></span>
                  <Badge variant={s.passed ? "success" : "danger"}>{s.percentage}%</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Report card preview</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!card} onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
              <Button size="sm" variant="outline" disabled={!card || downloading} onClick={downloadPdf}>
                {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!studentId ? (
            <EmptyState title="Select a student" description="Pick a student to preview their report card." />
          ) : cardQuery.isLoading ? (
            <LoadingState />
          ) : cardQuery.isError ? (
            <ErrorState message="Failed to load report card" onRetry={() => cardQuery.refetch()} />
          ) : card ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{card.student.firstName} {card.student.lastName}</p>
                <p className="text-xs text-slate-500">
                  {card.student.admissionNumber} · Class {card.student.class?.name}{card.student.section ? `-${card.student.section.name}` : ""}
                  {card.rank != null && ` · Rank ${card.rank}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={card.passed ? "success" : "danger"}>{card.passed ? "PASS" : "FAIL"}</Badge>
                  <Badge variant="default">{card.percentage}% · {card.grade}</Badge>
                  <Badge variant="secondary">{card.totalObtained}/{card.totalMax}</Badge>
                  {card.attendancePercentage != null && <Badge variant="secondary">Attendance {card.attendancePercentage}%</Badge>}
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-center">Max</TableHead>
                    <TableHead className="text-center">Obtained</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {card.subjects.map((s: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {s.subject?.name}
                        {s.isAbsent && <Badge variant="danger" className="ms-2">Absent</Badge>}
                        {s.isExempt && <Badge variant="secondary" className="ms-2">Exempt</Badge>}
                        {s.remarks && <div className="text-xs font-normal text-slate-500">{s.remarks}</div>}
                      </TableCell>
                      <TableCell className="text-center">{s.maxMarks}</TableCell>
                      <TableCell className="text-center font-semibold">{s.obtained ?? "—"}</TableCell>
                      <TableCell><Badge variant={(s.percentage ?? 0) >= 60 ? "success" : (s.percentage ?? 0) >= 40 ? "warning" : "danger"}>{s.grade || "—"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
