"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen,
  BookMarked,
  BookMinus,
  Clock,
  Plus,
  Search,
  Layers,
  Library,
  Loader2,
  Pencil,
  Trash2,
  Send,
  Undo2,
  X,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string | null;
  publisher?: string | null;
  category?: string | null;
  edition?: string | null;
  totalCopies: number;
  available: number;
  rack?: string | null;
  _count?: { issues: number };
}

interface LibraryIssue {
  id: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string | null;
  status: "ISSUED" | "RETURNED" | "OVERDUE";
  fine: number | string;
  book: { id: string; title: string; author: string; isbn?: string | null; rack?: string | null };
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
}

interface LibraryStats {
  totalBooks: number;
  availableCopies: number;
  issued: number;
  overdue: number;
  returned: number;
  activeLoans: number;
  categories: { name: string; count: number }[];
  recentIssues: LibraryIssue[];
  topBooks: { id: string; title: string; author: string }[];
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
}

type LibraryTab = "catalog" | "issues";

const issueStatusConfig = {
  ISSUED: { label: "library.statusIssued", className: "bg-blue-100 text-blue-700" },
  RETURNED: { label: "library.statusReturned", className: "bg-green-100 text-green-700" },
  OVERDUE: { label: "library.statusOverdue", className: "bg-red-100 text-red-700" },
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysOverdue(dueDate: string) {
  const diff = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function LibraryPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";
  const canManage =
    isSuperAdmin ||
    user?.roleName === "SCHOOL_ADMIN" ||
    user?.roleName === "PRINCIPAL" ||
    user?.roleName === "LIBRARIAN";

  const [tab, setTab] = useState<LibraryTab>("catalog");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bookModal, setBookModal] = useState<{ open: boolean; book?: Book }>({ open: false });
  const [issueModal, setIssueModal] = useState<Book | null>(null);
  const [returnModal, setReturnModal] = useState<LibraryIssue | null>(null);

  const schoolId = isSuperAdmin ? "" : user?.schoolId || "";

  const statsQuery = useQuery({
    queryKey: ["library-dashboard", schoolId],
    queryFn: async () => {
      const res = await api.get("/library/dashboard", {
        params: schoolId ? { schoolId } : {},
      });
      return res.data.data as LibraryStats;
    },
  });

  const booksQuery = useQuery({
    queryKey: ["library-books", search, category, schoolId],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (search) params.search = search;
      if (category !== "all") params.category = category;
      if (schoolId) params.schoolId = schoolId;
      const res = await api.get("/library", { params });
      return res.data.data as Book[];
    },
  });

  const issuesQuery = useQuery({
    queryKey: ["library-issues", statusFilter, schoolId],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (statusFilter !== "all") params.status = statusFilter;
      if (schoolId) params.schoolId = schoolId;
      const res = await api.get("/library/issues", { params });
      return res.data.data as LibraryIssue[];
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["library-students", schoolId],
    queryFn: async () => {
      const params: any = { limit: 60 };
      if (schoolId) params.schoolId = schoolId;
      const res = await api.get("/students", { params });
      return res.data.data as Student[];
    },
    enabled: !!issueModal,
  });

  const saveBookMutation = useMutation({
    mutationFn: async ({ book, data }: { book?: Book; data: any }) => {
      if (book) {
        await api.put(`/library/${book.id}`, data);
      } else {
        await api.post("/library", data);
      }
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.book ? t("library.bookUpdated") : t("library.bookAdded"));
      setBookModal({ open: false });
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      queryClient.invalidateQueries({ queryKey: ["library-dashboard"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteBookMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/library/${id}`);
    },
    onSuccess: () => {
      toast.success(t("library.bookRemoved"));
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      queryClient.invalidateQueries({ queryKey: ["library-dashboard"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const issueMutation = useMutation({
    mutationFn: async (data: { bookId: string; studentId: string; dueDate?: string }) => {
      await api.post("/library/issues", data);
    },
    onSuccess: () => {
      toast.success(t("library.bookIssued"));
      setIssueModal(null);
      queryClient.invalidateQueries({ queryKey: ["library-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      queryClient.invalidateQueries({ queryKey: ["library-issues"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const returnMutation = useMutation({
    mutationFn: async ({ issueId, fine }: { issueId: string; fine: number }) => {
      await api.patch(`/library/issues/${issueId}/return`, { fine });
    },
    onSuccess: () => {
      toast.success(t("library.bookReturned"));
      setReturnModal(null);
      queryClient.invalidateQueries({ queryKey: ["library-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      queryClient.invalidateQueries({ queryKey: ["library-issues"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const stats = statsQuery.data;
  const books = booksQuery.data || [];

  const availableCategories = useMemo(() => {
    const categoriesMap = new Set<string>();
    books.forEach((b) => b.category && categoriesMap.add(b.category));
    return Array.from(categoriesMap).sort();
  }, [books]);

  const filteredIssues = useMemo(() => {
    const issues = issuesQuery.data || [];
    return issues;
  }, [issuesQuery.data]);

  const pendingDelete = deleteBookMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("nav.library")}</h1>
          <p className="text-sm text-slate-500">{t("library.subtitle")}</p>
        </div>
        {canManage && (
          <Button onClick={() => setBookModal({ open: true })}>
            <Plus className="ms-2 h-4 w-4" />{t("library.addBook")}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("library.statTotalTitles")}
          value={String(stats?.totalBooks ?? 0)}
          change={stats?.categories?.length ? t("library.categoryCount", { count: stats.categories.length }) : undefined}
          icon={<BookOpen className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-600"
        />
        <StatCard
          title={t("library.statAvailableCopies")}
          value={String(stats?.availableCopies ?? 0)}
          change={t("library.copiesOnLoan", { count: (stats?.issued ?? 0) + (stats?.overdue ?? 0) })}
          icon={<BookMinus className="h-5 w-5" />}
          iconBg="bg-green-50 text-green-600"
        />
        <StatCard
          title={t("library.statIssued")}
          value={String(stats?.issued ?? 0)}
          change={t("library.returnedTotal", { count: stats?.returned ?? 0 })}
          icon={<BookMarked className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-600"
        />
        <StatCard
          title={t("library.statOverdue")}
          value={String(stats?.overdue ?? 0)}
          change={stats && stats.overdue > 0 ? t("library.actionRequired") : undefined}
          icon={<Clock className="h-5 w-5" />}
          iconBg="bg-red-50 text-red-600"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <button
          onClick={() => setTab("catalog")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            tab === "catalog" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Library className="h-4 w-4" />
          {t("library.tabCatalog")}
        </button>
        <button
          onClick={() => setTab("issues")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            tab === "issues" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <BookMarked className="h-4 w-4" />
          {t("library.tabIssues")}
          {stats && stats.activeLoans > 0 && (
            <span
              className={`ms-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                tab === "issues" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {stats.activeLoans}
            </span>
          )}
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="ps-9"
            placeholder={tab === "catalog" ? t("library.searchPlaceholderCatalog") : t("library.searchPlaceholderIssues")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {tab === "catalog" ? (
          <div className="relative">
            <Layers className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Select
              className="w-52 ps-9"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">{t("library.allCategories")}</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {[
              { key: "all", labelKey: "common.all" },
              { key: "ISSUED", labelKey: "library.statusIssued" },
              { key: "OVERDUE", labelKey: "library.statusOverdue" },
              { key: "RETURNED", labelKey: "library.statusReturned" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  statusFilter === s.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {tab === "catalog" ? (
        booksQuery.isLoading ? (
          <LoadingState label={t("library.loadingCatalog")} />
        ) : booksQuery.isError ? (
          <ErrorState message={t("library.failedToLoadBooks")} onRetry={() => booksQuery.refetch()} />
        ) : books.length === 0 ? (
          <EmptyState
            title={t("library.noBooks")}
            description={search || category !== "all" ? t("library.tryAdjustingFilters") : t("library.addFirstBook")}
            action={canManage ? <Button onClick={() => setBookModal({ open: true })}><Plus className="ms-2 h-4 w-4" />{t("library.addBook")}</Button> : undefined}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {books.map((book) => (
              <div
                key={book.id}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60"
              >
                <div className="absolute end-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-slate-100 transition-colors group-hover:bg-blue-50" />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <Badge
                      variant={
                        book.available > 0 ? "success" : book.totalCopies === 0 ? "danger" : "warning"
                      }
                      className="shrink-0"
                    >
                      {book.available > 0 ? t("library.availableCount", { count: book.available }) : t("library.outOfStock")}
                    </Badge>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-slate-900 leading-snug">{book.title}</h3>
                  <p className="mt-0.5 text-sm text-slate-500">{book.author}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {book.category && (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {book.category}
                      </span>
                    )}
                    {book.rack && (
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                        {t("library.rackLabel", { rack: book.rack })}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-medium">{book.available}/{book.totalCopies} {t("library.copiesLabel")}</span>
                    {book.isbn && <span className="font-mono text-slate-400">{book.isbn}</span>}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {canManage && book.available > 0 && (
                      <Button
                        size="sm"
                        onClick={() => setIssueModal(book)}
                      >
                        <Send className="ms-1 h-3.5 w-3.5" />
                        {t("library.issueAction")}
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBookModal({ open: true, book })}
                      >
                        <Pencil className="ms-1 h-3.5 w-3.5" />
                        {t("common.edit")}
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        disabled={pendingDelete}
                        onClick={() => {
                          if (window.confirm(t("library.deleteConfirm", { name: book.title }))) {
                            deleteBookMutation.mutate(book.id);
                          }
                        }}
                      >
                        {pendingDelete ? <Loader2 className="ms-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="ms-1 h-3.5 w-3.5" />}
                        {t("common.delete")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </div>
            ))}
          </div>
        )
      ) : issuesQuery.isLoading ? (
        <LoadingState label={t("library.loadingIssues")} />
      ) : issuesQuery.isError ? (
        <ErrorState message={t("library.failedToLoadIssues")} onRetry={() => issuesQuery.refetch()} />
      ) : filteredIssues.length === 0 ? (
        <EmptyState
          title={t("library.noIssues")}
          description={t("library.noIssuesDesc")}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("library.transactions")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("library.colStudent")}</TableHead>
                  <TableHead>{t("library.colBook")}</TableHead>
                  <TableHead className="text-center">{t("library.colIssued")}</TableHead>
                  <TableHead className="text-center">{t("library.colDue")}</TableHead>
                  <TableHead className="text-center">{t("common.status")}</TableHead>
                  <TableHead className="text-center">{t("library.fineLabel")}</TableHead>
                  <TableHead className="text-end">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIssues.map((issue) => {
                  const overdue = issue.status !== "RETURNED" && (issue.status === "OVERDUE" || daysOverdue(issue.dueDate) < 0);
                  return (
                    <TableRow key={issue.id}>
                      <TableCell>
                        <div className="font-medium">{issue.student.firstName} {issue.student.lastName}</div>
                        <div className="font-mono text-xs text-slate-400">{issue.student.admissionNumber}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{issue.book.title}</div>
                        <div className="text-xs text-slate-400">{issue.book.author}{issue.book.rack ? ` · ${t("library.rackLabel", { rack: issue.book.rack })}` : ""}</div>
                      </TableCell>
                      <TableCell className="text-center text-slate-600">{formatDate(issue.issueDate)}</TableCell>
                      <TableCell className={`text-center ${overdue ? "font-semibold text-red-600" : "text-slate-600"}`}>
                        {formatDate(issue.dueDate)}
                        {overdue && <span className="block text-[10px] font-medium">{t("library.daysOverdueCount", { count: Math.abs(daysOverdue(issue.dueDate)) })}</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            issueStatusConfig[issue.status]?.className || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {issue.status === "OVERDUE" && <AlertTriangle className="h-3 w-3" />}
                          {issue.status === "ISSUED" && <Clock className="h-3 w-3" />}
                          {issue.status === "RETURNED" && <Undo2 className="h-3 w-3" />}
                          {issueStatusConfig[issue.status]?.label ? t(issueStatusConfig[issue.status].label) : issue.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-slate-600">
                        {issue.fine ? Number(issue.fine).toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        {issue.status !== "RETURNED" && canManage && (
                          <Button size="sm" variant="outline" onClick={() => setReturnModal(issue)}>
                            <Undo2 className="ms-1 h-3.5 w-3.5" />
                            {t("library.returnAction")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Book Modal */}
      {bookModal.open && (
        <BookFormModal
          book={bookModal.book}
          isLoading={saveBookMutation.isPending}
          error={saveBookMutation.error ? getErrorMessage(saveBookMutation.error) : undefined}
          onClose={() => setBookModal({ open: false })}
          onSubmit={(data) => saveBookMutation.mutate({ book: bookModal.book, data })}
        />
      )}

      {/* Issue Modal */}
      {issueModal && (
        <IssueModal
          book={issueModal}
          students={studentsQuery.data || []}
          studentsLoading={studentsQuery.isLoading}
          isLoading={issueMutation.isPending}
          error={issueMutation.error ? getErrorMessage(issueMutation.error) : undefined}
          onClose={() => setIssueModal(null)}
          onSubmit={(data) => issueMutation.mutate({ bookId: issueModal.id, ...data })}
        />
      )}

      {/* Return Modal */}
      {returnModal && (
        <ReturnModal
          issue={returnModal}
          isLoading={returnMutation.isPending}
          onClose={() => setReturnModal(null)}
          onSubmit={(fine) => returnMutation.mutate({ issueId: returnModal.id, fine })}
        />
      )}
    </div>
  );
}

/* ---------- Modals ---------- */

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function BookFormModal({
  book,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  book?: Book;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    title: book?.title || "",
    author: book?.author || "",
    isbn: book?.isbn || "",
    publisher: book?.publisher || "",
    category: book?.category || "",
    edition: book?.edition || "",
    totalCopies: book ? String(book.totalCopies) : "1",
    rack: book?.rack || "",
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: form.title.trim(),
      author: form.author.trim(),
      isbn: form.isbn.trim() || undefined,
      publisher: form.publisher.trim() || undefined,
      category: form.category.trim() || undefined,
      edition: form.edition.trim() || undefined,
      totalCopies: Math.max(1, parseInt(form.totalCopies) || 1),
      rack: form.rack.trim() || undefined,
    });
  };

  return (
    <ModalShell
      title={book ? t("library.editBook") : t("library.addBook")}
      subtitle={book ? t("library.updateBookDetails") : t("library.addBookDesc")}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="grid gap-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={`${t("common.title")} *`}>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} required placeholder={t("library.titlePlaceholder")} />
            </Field>
          </div>
          <Field label={`${t("library.author")} *`}>
            <Input value={form.author} onChange={(e) => set("author", e.target.value)} required placeholder={t("library.authorPlaceholder")} />
          </Field>
          <Field label={t("library.isbn")}>
            <Input value={form.isbn} onChange={(e) => set("isbn", e.target.value)} placeholder="978-0131103627" />
          </Field>
          <Field label={t("library.category")}>
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder={t("library.categoryPlaceholder")} />
          </Field>
          <Field label={t("library.rack")}>
            <Input value={form.rack} onChange={(e) => set("rack", e.target.value)} placeholder={t("library.rackPlaceholder")} />
          </Field>
          <Field label={t("library.publisher")}>
            <Input value={form.publisher} onChange={(e) => set("publisher", e.target.value)} />
          </Field>
          <Field label={t("library.edition")}>
            <Input value={form.edition} onChange={(e) => set("edition", e.target.value)} />
          </Field>
          <Field label={`${t("library.totalCopies")} *${book ? ` ${t("library.currentlyX", { count: book.totalCopies })}` : ""}`}>
            <Input
              type="number"
              min={1}
              value={form.totalCopies}
              onChange={(e) => set("totalCopies", e.target.value)}
              required
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            {book ? t("library.saveChanges") : t("library.addBook")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function IssueModal({
  book,
  students,
  studentsLoading,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  book: Book;
  students: Student[];
  studentsLoading: boolean;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: { studentId: string; dueDate?: string }) => void;
}) {
  const { t } = useI18n();
  const [studentId, setStudentId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const defaultDue = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <ModalShell
      title={t("library.issueBookTitle")}
      subtitle={`${book.title} · ${book.author}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!studentId) return;
          onSubmit({ studentId, dueDate: dueDate || undefined });
        }}
        className="grid gap-4 p-6"
      >
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-900">{book.title}</p>
            <p className="text-xs text-slate-500">{t("library.copiesAvailable", { count: book.available })}</p>
          </div>
          {book.rack && (
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
              {t("library.rackLabel", { rack: book.rack })}
            </span>
          )}
        </div>

        <Field label={`${t("library.student")} *`}>
          <Select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            disabled={studentsLoading}
          >
            <option value="" disabled>
              {studentsLoading ? t("library.loadingStudents") : t("library.selectStudent")}
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} ({s.admissionNumber})
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("library.dueDateLabel")}>
          <Input type="date" value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDueDate(e.target.value)} />
          {!dueDate && <span className="mt-1 block text-xs text-slate-400">{t("library.defaultsTo", { date: defaultDue })}</span>}
        </Field>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isLoading || !studentId}>
            {isLoading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            {t("library.issueBookTitle")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function ReturnModal({
  issue,
  isLoading,
  onClose,
  onSubmit,
}: {
  issue: LibraryIssue;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (fine: number) => void;
}) {
  const { t } = useI18n();
  const overdue =
    issue.status === "OVERDUE" ||
    (issue.status === "ISSUED" && daysOverdue(issue.dueDate) < 0);
  const suggestedFine = overdue ? Math.abs(daysOverdue(issue.dueDate)) * 1 : 0;
  const [fine, setFine] = useState(String(suggestedFine));

  return (
    <ModalShell
      title={t("library.returnBookTitle")}
      subtitle={`${issue.book.title} · ${issue.student.firstName} ${issue.student.lastName}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(Math.max(0, parseFloat(fine) || 0));
        }}
        className="grid gap-4 p-6"
      >
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-4 text-center text-sm">
          <div>
            <p className="text-xs text-slate-500">{t("library.colIssued")}</p>
            <p className="mt-0.5 font-medium text-slate-800">{formatDate(issue.issueDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("library.colDue")}</p>
            <p className={`mt-0.5 font-medium ${overdue ? "text-red-600" : "text-slate-800"}`}>{formatDate(issue.dueDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("common.status")}</p>
            <span
              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                issueStatusConfig[issue.status]?.className
              }`}
            >
              {overdue ? t("library.statusOverdue") : issueStatusConfig[issue.status]?.label ? t(issueStatusConfig[issue.status].label) : issue.status}
            </span>
          </div>
        </div>

        {overdue && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {t("library.overdueWarning", {
                count: Math.abs(daysOverdue(issue.dueDate)),
                fine: suggestedFine.toFixed(2),
              })}
            </span>
          </div>
        )}

        <Field label={t("library.fineLabel")}>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={fine}
            onChange={(e) => setFine(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            {t("library.confirmReturn")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}