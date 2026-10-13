"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, KeyRound, Download, Power, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, getErrorMessage } from "@/lib/api";

function toCredsCsv(rows: { username?: string | null; tempPassword?: string | null; id: string }[]): string {
  const header = "username,tempPassword";
  const lines = rows
    .filter((r) => r.username && r.tempPassword)
    .map((r) =>
      [r.username || "", r.tempPassword || ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
  return [header, ...lines].join("\n");
}

function downloadFile(filename: string, text: string, type = "text/csv") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function toCsv(rows: any[]): string {
  const header = "username,email,name,role,active,lastLogin,linked";
  const lines = rows.map((u: any) =>
    [
      u.username || "", u.email || "",
      `${u.firstName || ""} ${u.lastName || ""}`.trim(),
      u.role?.name || "",
      u.isActive ? "yes" : "no",
      u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : "",
      u.studentProfile?.admissionNumber || u.teacherProfile?.employeeId || "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...lines].join("\n");
}

export default function AppLoginsPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["app-logins", role, search, page],
    queryFn: async () => {
      const res = await api.get("/credentials", { params: { role, search, page, limit: 25 } });
      return res.data;
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.post(`/credentials/users/${userId}/reset-password`);
      return res.data.data;
    },
    onSuccess: (d) => {
      toast.success(`New temporary password for ${d.username}: ${d.tempPassword}`, { duration: 12000 });
      queryClient.invalidateQueries({ queryKey: ["app-logins"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const activeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/credentials/users/${id}/active`, { isActive });
    },
    onSuccess: (_d, v) => {
      toast.success(v.isActive ? "Access enabled" : "Access disabled");
      queryClient.invalidateQueries({ queryKey: ["app-logins"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const users = data?.data || [];

  // ---- Bulk creation for records without logins ----
  const [createKind, setCreateKind] = useState<"student" | "teacher">("student");
  const [createSearch, setCreateSearch] = useState("");
  const [createPage, setCreatePage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkResults, setBulkResults] = useState<
    { id: string; ok: boolean; username?: string | null; tempPassword?: string | null; error?: string }[] | null
  >(null);

  const unprovQuery = useQuery({
    queryKey: ["unprovisioned", createKind, createSearch, createPage],
    queryFn: async () => {
      const res = await api.get("/credentials/unprovisioned", {
        params: { kind: createKind, search: createSearch, page: createPage, limit: 25 },
      });
      return res.data;
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await api.post("/credentials/bulk", { kind: createKind, ids });
      return res.data.data as {
        id: string; ok: boolean; username?: string | null; tempPassword?: string | null; error?: string;
      }[];
    },
    onSuccess: (rows) => {
      setBulkResults(rows);
      setSelected([]);
      const ok = rows.filter((r) => r.ok && r.tempPassword).length;
      toast.success(`Created ${ok} of ${rows.length} logins — download the CSV now (passwords shown once)`);
      queryClient.invalidateQueries({ queryKey: ["app-logins"] });
      queryClient.invalidateQueries({ queryKey: ["unprovisioned"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const pending = unprovQuery.data?.data || [];
  const allPageIds = pending.map((r: any) => r.id);
  const allChecked = allPageIds.length > 0 && allPageIds.every((id: string) => selected.includes(id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <KeyRound className="h-6 w-6 text-primary-600" /> Mobile App Logins
          </h1>
          <p className="text-sm text-slate-500">
            Create and manage student &amp; teacher logins for the SchoolSphere mobile app.
            Usernames + temporary passwords generated here work directly in the app.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!users.length}
          onClick={() => {
            const blob = new Blob([toCsv(users)], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `app-logins-${role.toLowerCase()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Login accounts</CardTitle>
            <div className="flex gap-2">
              <div className="flex rounded-md border border-slate-200 p-0.5 text-sm">
                {(["STUDENT", "TEACHER"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => { setRole(r); setPage(1); }}
                    className={`rounded px-3 py-1.5 font-medium ${role === r ? "bg-slate-900 text-white" : "text-slate-500"}`}
                  >
                    {r === "STUDENT" ? "Students" : "Teachers"}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="w-64 ps-9" placeholder="Search username, email, name…"
                  value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <LoadingState /> : isError ? (
            <ErrorState message="Failed to load login accounts" onRetry={() => refetch()} />
          ) : users.length === 0 ? (
            <EmptyState
              title={`No ${role.toLowerCase()} logins yet`}
              description="Open Students or Teachers, click the key icon on a row, and create a mobile login. It will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Linked record</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">{u.username || "—"}</TableCell>
                    <TableCell className="font-medium">{u.firstName} {u.lastName}<div className="text-xs font-normal text-slate-500">{u.email}</div></TableCell>
                    <TableCell className="font-mono text-xs">{u.studentProfile?.admissionNumber || u.teacherProfile?.employeeId || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "success" : "secondary"}>{u.isActive ? "Active" : "Disabled"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Reset password" onClick={() => {
                          if (window.confirm(`Reset password for ${u.username || u.email}?`)) resetMutation.mutate(u.id);
                        }}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={u.isActive ? "Disable access" : "Enable access"} onClick={() => activeMutation.mutate({ id: u.id, isActive: !u.isActive })}>
                          <Power className={`h-4 w-4 ${u.isActive ? "" : "text-amber-600"}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {(data?.meta?.totalPages || 1) > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500">Page {page} of {data.meta.totalPages} · {data.meta.total} accounts</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Bulk create logins</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                Students / teachers without a login yet. Select rows → create → download the username + temporary-password CSV (shown once).
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex rounded-md border border-slate-200 p-0.5 text-sm">
                {(["student", "teacher"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => { setCreateKind(k); setCreatePage(1); setSelected([]); setBulkResults(null); }}
                    className={`rounded px-3 py-1.5 font-medium ${createKind === k ? "bg-slate-900 text-white" : "text-slate-500"}`}
                  >
                    {k === "student" ? "Students" : "Teachers"}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="w-56 ps-9" placeholder="Search name, adm / emp no…"
                  value={createSearch} onChange={(e) => { setCreateSearch(e.target.value); setCreatePage(1); }}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {unprovQuery.isLoading ? <LoadingState /> : unprovQuery.isError ? (
            <ErrorState message="Failed to load records" onRetry={() => unprovQuery.refetch()} />
          ) : pending.length === 0 ? (
            <EmptyState title="Everyone has a login" description="All students / teachers of this type already have mobile access." />
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={!selected.length || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate(selected)}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {bulkMutation.isPending ? "Creating…" : `Create logins for selected (${selected.length})`}
                </Button>
                {selected.length > 0 && (
                  <button className="text-xs text-slate-500 underline" onClick={() => setSelected([])}>Clear</button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => setSelected(e.target.checked ? allPageIds : [])}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>{createKind === "student" ? "Admission no · Class" : "Employee ID"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.includes(r.id)}
                          onChange={(e) => setSelected(
                            e.target.checked ? [...selected, r.id] : selected.filter((id) => id !== r.id)
                          )}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.firstName} {r.lastName}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {createKind === "student"
                          ? `${r.admissionNumber || "—"}${r.class?.name ? ` · ${r.class.name}` : ""}${r.section?.name ? ` / ${r.section.name}` : ""}`
                          : r.employeeId || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(unprovQuery.data?.meta?.totalPages || 1) > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <p className="text-sm text-slate-500">Page {createPage} of {unprovQuery.data.meta.totalPages} · {unprovQuery.data.meta.total} without logins</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={createPage <= 1} onClick={() => setCreatePage(createPage - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={createPage >= unprovQuery.data.meta.totalPages} onClick={() => setCreatePage(createPage + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
          {!!bulkResults?.length && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-800">
                  New credentials (shown once — download now): {bulkResults.filter((r) => r.ok && r.tempPassword).length} created
                  {bulkResults.filter((r) => !r.ok).length > 0 && `, ${bulkResults.filter((r) => !r.ok).length} failed`}
                </p>
                <Button
                  size="sm" variant="outline"
                  onClick={() => downloadFile(`schoolsphere-logins-${createKind}-bulk.csv`, toCredsCsv(bulkResults))}
                >
                  <Download className="mr-1 h-3.5 w-3.5" /> Download CSV
                </Button>
              </div>
              <div className="mt-2 max-h-48 overflow-auto font-mono text-xs">
                {bulkResults.map((r) => (
                  <div key={r.id} className="flex justify-between gap-2 border-b border-amber-100 py-1">
                    <span>{r.username || r.id}</span>
                    <span>{r.ok ? r.tempPassword : `FAILED: ${r.error}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-blue-100 bg-blue-50/40">
        <CardContent className="pt-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">How it works</p>
          <ol className="mt-1 list-decimal space-y-1 ps-5">
            <li>Admit a student (or add a teacher) with class / section / subject assignment.</li>
            <li>Click the <KeyRound className="inline h-3.5 w-3.5" /> key icon on their row → <em>Create mobile login</em> — or select many below in <em>Bulk create logins</em>.</li>
            <li>Copy or download the username + temporary password and share it securely.</li>
            <li>They log in to the SchoolSphere mobile app — role-based dashboard opens automatically.</li>
            <li>Disable access or reset passwords anytime from here.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
