"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package,
  Boxes,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Search,
  ShieldCheck,
  Wallet,
  TrendingDown,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

/* ================= Types ================= */

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string | null;
  unit: string;
  quantity: number;
  minStock: number;
  purchasePrice: number | null;
  department?: string | null;
  location?: string | null;
  schoolId?: string;
  stockStatus?: string;
  createdAt: string;
  _count?: { transactions: number };
}

interface InventoryAsset {
  id: string;
  name: string;
  assetCode: string;
  category: string;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  purchasePrice: number | null;
  warrantyExpiry?: string | null;
  location?: string | null;
  condition?: string | null;
  assignedTo?: string | null;
  department?: string | null;
  schoolId?: string;
  status: string;
}

interface InvTx {
  id: string;
  type: string;
  quantity: number;
  note?: string | null;
  createdAt: string;
  item: {
    id: string;
    name: string;
    code: string;
    unit: string;
    category: string;
    department?: string | null;
  };
}

interface InventoryStats {
  totalItems: number;
  categories: number;
  departments: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
  assetsCount: number;
  byCategory: { category: string; count: number }[];
  byDepartment: { department: string; count: number }[];
  recentTransactions: InvTx[];
}

interface SchoolOption {
  id: string;
  name: string;
  schoolCode: string;
}

/* ================= Formatters ================= */

const cur = (v?: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const fmtDt = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

const stockBadge = (status?: string, t?: (k: string) => string) => {
  const tx = t || ((k: string) => k);
  switch (status) {
    case "LOW": return <Badge variant="warning">{tx("inventory.statusLowStock")}</Badge>;
    case "OUT": return <Badge variant="danger">{tx("inventory.statusOutOfStock")}</Badge>;
    default: return <Badge variant="success">{tx("inventory.statusInStock")}</Badge>;
  }
};

const assetStatusBadge = (asset: InventoryAsset, t?: (k: string) => string) => {
  const tx = t || ((k: string) => k);
  const cond = (asset.condition || "Good").toLowerCase();
  if (asset.status === "MAINTENANCE" || cond === "needs repair" || cond === "under repair") {
    return <Badge variant="warning">{tx("inventory.statusMaintenance")}</Badge>;
  }
  if (asset.status === "INACTIVE" || asset.status === "DISPOSED") return <Badge variant="secondary">{tx("inventory.statusInactive")}</Badge>;
  if (cond === "excellent") return <Badge variant="success">{tx("inventory.statusExcellent")}</Badge>;
  return <Badge variant="success">{tx("inventory.statusActive")}</Badge>;
};

const txBadge = (type: string, t?: (k: string) => string) => {
  const tx = t || ((k: string) => k);
  switch (type) {
    case "IN": return <Badge variant="success">{tx("inventory.txIn")}</Badge>;
    case "OUT": return <Badge variant="danger">{tx("inventory.txOut")}</Badge>;
    default: return <Badge variant="warning">{tx("inventory.txAdjusted")}</Badge>;
  }
};

/* ================= UI helpers ================= */

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

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

/* ================= Item modal ================= */

function ItemModal({
  item,
  departments,
  isSuperAdmin,
  schools,
  selectedSchoolId,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  item?: InventoryItem;
  departments: string[];
  isSuperAdmin?: boolean;
  schools?: SchoolOption[];
  selectedSchoolId?: string;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    code: item?.code || "",
    name: item?.name || "",
    category: item?.category || "",
    unit: item?.unit || "unit",
    quantity: item?.quantity != null ? String(item.quantity) : "0",
    minStock: item?.minStock != null ? String(item.minStock) : "5",
    purchasePrice: item?.purchasePrice != null ? String(item.purchasePrice) : "",
    department: item?.department || "",
    location: item?.location || "",
    description: item?.description || "",
    schoolId: item?.schoolId || selectedSchoolId || "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <ModalShell
      title={item ? t("inventory.editItem") : t("inventory.addItem")}
      subtitle={item ? t("inventory.updateItemDesc") : t("inventory.addItemDesc")}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            code: form.code.trim().toUpperCase(),
            name: form.name.trim(),
            category: form.category.trim(),
            unit: form.unit.trim() || "unit",
            quantity: Math.max(0, Number(form.quantity) || 0),
            minStock: Math.max(0, Number(form.minStock) || 0),
            purchasePrice: form.purchasePrice.trim() === "" ? null : Math.max(0, Number(form.purchasePrice)),
            department: form.department.trim() || null,
            location: form.location.trim() || null,
            description: form.description.trim() || null,
            ...(isSuperAdmin ? { schoolId: form.schoolId } : {}),
          });
        }}
        className="grid gap-4 p-6"
      >
        {isSuperAdmin && (
          <Field label={t("inventory.schoolRequired")} hint={t("inventory.schoolHint")}>
            <Select value={form.schoolId} onChange={(e) => set("schoolId", e.target.value)} required>
              <option value="" disabled>{t("inventory.selectSchool")}</option>
              {(schools || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.schoolCode})</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("inventory.codeRequired")} hint={t("inventory.codeHint")}>
            <Input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder={t("inventory.codePlaceholder")} required />
          </Field>
          <Field label={t("inventory.categoryRequired")}>
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder={t("inventory.categoryPlaceholder")} required />
          </Field>
          <Field label={t("inventory.itemNameRequired")}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("inventory.itemNamePlaceholder")} required />
          </Field>
          <Field label={t("inventory.unitRequired")}>
            <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder={t("inventory.unitPlaceholder")} list="inv-unit-list" />
            <datalist id="inv-unit-list">
              <option value="unit" /><option value="box" /><option value="ream" /><option value="pack" /><option value="kg" /><option value="ltr" /><option value="set" />
            </datalist>
          </Field>
          <Field label={t("inventory.department")} hint={t("inventory.departmentHint")}>
            <Input list="inv-dept-list" value={form.department} onChange={(e) => set("department", e.target.value)} placeholder={t("inventory.deptPlaceholder")} />
            <datalist id="inv-dept-list">
              {departments.map((d) => <option key={d} value={d} />)}
            </datalist>
          </Field>
          <Field label={t("inventory.location")}>
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder={t("inventory.locationPlaceholder")} />
          </Field>
          <Field label={t("inventory.inStock")}>
            <Input type="number" min={0} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} disabled={!!item} />
          </Field>
          <Field label={t("inventory.reorderLevel")} hint={t("inventory.reorderHint")}>
            <Input type="number" min={0} value={form.minStock} onChange={(e) => set("minStock", e.target.value)} />
          </Field>
          <Field label={t("inventory.unitPrice")}>
            <Input type="number" min={0} step="0.01" value={form.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} placeholder={t("inventory.pricePlaceholder")} />
          </Field>
          <Field label={t("inventory.description")} hint={`${form.description.trim().length}/500`}>
            <Input value={form.description} onChange={(e) => set("description", e.target.value.slice(0, 500))} placeholder={t("inventory.notesPlaceholder")} />
          </Field>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {item ? t("inventory.saveChanges") : t("inventory.addItem")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ================= Movement modal ================= */

function MovementModal({
  item,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  item: InventoryItem;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: { itemId: string; type: string; quantity: number; note?: string | null }) => void;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<"IN" | "OUT" | "ADJUST">("IN");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const isAdjust = type === "ADJUST";

  return (
    <ModalShell
      title={t("inventory.movementTitle", { name: item.name })}
      subtitle={t("inventory.currentStock", { qty: String(item.quantity), unit: item.unit, code: item.code })}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            itemId: item.id,
            type,
            quantity: Math.max(1, Number(quantity) || 0),
            note: note.trim() || null,
          });
        }}
        className="grid gap-4 p-6"
      >
        <div className="grid grid-cols-3 gap-2">
          {(["IN", "OUT", "ADJUST"] as const).map((mt) => (
            <button
              key={mt}
              type="button"
              onClick={() => setType(mt)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                type === mt
                  ? mt === "IN"
                    ? "border-green-300 bg-green-50 text-green-700"
                    : mt === "OUT"
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {mt === "IN" ? <ArrowDownToLine className="h-4 w-4" /> : mt === "OUT" ? <ArrowUpFromLine className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              {mt === "IN" ? t("inventory.txIn") : mt === "OUT" ? t("inventory.txOut") : t("inventory.adjust")}
            </button>
          ))}
        </div>

        <Field
          label={isAdjust ? t("inventory.newTotalQty") : type === "IN" ? t("inventory.quantityToAdd") : t("inventory.quantityToRemove")}
          hint={isAdjust ? t("inventory.adjustHint") : undefined}
        >
          <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t("inventory.quantityPlaceholder", { qty: String(item.quantity > 0 ? item.quantity : 10) })} required />
        </Field>
        <Field label={t("inventory.note")}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "IN" ? t("inventory.noteInPlaceholder") : type === "OUT" ? t("inventory.noteOutPlaceholder") : t("inventory.noteAdjustPlaceholder")} />
        </Field>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("inventory.recordMovement")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ================= Asset modal ================= */

function AssetModal({
  asset,
  departments,
  isSuperAdmin,
  schools,
  selectedSchoolId,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  asset?: InventoryAsset;
  departments: string[];
  isSuperAdmin?: boolean;
  schools?: SchoolOption[];
  selectedSchoolId?: string;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: asset?.name || "",
    assetCode: asset?.assetCode || "",
    category: asset?.category || "",
    serialNumber: asset?.serialNumber || "",
    purchaseDate: asset?.purchaseDate ? asset.purchaseDate.slice(0, 10) : "",
    purchasePrice: asset?.purchasePrice != null ? String(asset.purchasePrice) : "",
    warrantyExpiry: asset?.warrantyExpiry ? asset.warrantyExpiry.slice(0, 10) : "",
    location: asset?.location || "",
    condition: asset?.condition || "Good",
    assignedTo: asset?.assignedTo || "",
    department: asset?.department || "",
    status: asset?.status || "ACTIVE",
    schoolId: asset?.schoolId || selectedSchoolId || "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <ModalShell
      title={asset ? t("inventory.editAsset") : t("inventory.addAsset")}
      subtitle={asset ? t("inventory.updateAssetDesc") : t("inventory.addAssetDesc")}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name: form.name.trim(),
            assetCode: form.assetCode.trim().toUpperCase(),
            category: form.category.trim(),
            serialNumber: form.serialNumber.trim() || null,
            purchaseDate: form.purchaseDate || null,
            purchasePrice: form.purchasePrice.trim() === "" ? null : Math.max(0, Number(form.purchasePrice)),
            warrantyExpiry: form.warrantyExpiry || null,
            location: form.location.trim() || null,
            condition: form.condition.trim() || "Good",
            assignedTo: form.assignedTo.trim() || null,
            department: form.department.trim() || null,
            status: form.status,
            ...(isSuperAdmin ? { schoolId: form.schoolId } : {}),
          });
        }}
        className="grid gap-4 p-6"
      >
        {isSuperAdmin && (
          <Field label={t("inventory.schoolRequired")}>
            <Select value={form.schoolId} onChange={(e) => set("schoolId", e.target.value)} required>
              <option value="" disabled>{t("inventory.selectSchool")}</option>
              {(schools || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.schoolCode})</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("inventory.assetNameRequired")}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("inventory.assetNamePlaceholder")} required />
          </Field>
          <Field label={t("inventory.assetCodeRequired")} hint={t("inventory.assetCodeHint")}>
            <Input value={form.assetCode} onChange={(e) => set("assetCode", e.target.value)} placeholder={t("inventory.assetCodePlaceholder")} required />
          </Field>
          <Field label={t("inventory.categoryRequired")}>
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder={t("inventory.assetCategoryPlaceholder")} required />
          </Field>
          <Field label={t("inventory.serialNumber")}>
            <Input value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} placeholder={t("inventory.serialPlaceholder")} />
          </Field>
          <Field label={t("inventory.purchaseDate")}>
            <Input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} />
          </Field>
          <Field label={t("inventory.purchasePrice")}>
            <Input type="number" min={0} step="0.01" value={form.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} placeholder={t("inventory.assetPricePlaceholder")} />
          </Field>
          <Field label={t("inventory.warrantyExpiry")}>
            <Input type="date" value={form.warrantyExpiry} onChange={(e) => set("warrantyExpiry", e.target.value)} />
          </Field>
          <Field label={t("inventory.condition")}>
            <Select value={form.condition} onChange={(e) => set("condition", e.target.value)}>
              <option>{t("inventory.condExcellent")}</option>
              <option>{t("inventory.condGood")}</option>
              <option>{t("inventory.condFair")}</option>
              <option>{t("inventory.condNeedsRepair")}</option>
            </Select>
          </Field>
          <Field label={t("inventory.department")} hint={t("inventory.assetDeptHint")}>
            <Input list="inv-asset-dept-list" value={form.department} onChange={(e) => set("department", e.target.value)} placeholder={t("inventory.deptPlaceholder")} />
            <datalist id="inv-asset-dept-list">
              {departments.map((d) => <option key={d} value={d} />)}
            </datalist>
          </Field>
          <Field label={t("inventory.location")}>
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder={t("inventory.assetLocationPlaceholder")} />
          </Field>
          <Field label={t("inventory.assignedTo")}>
            <Input value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} placeholder={t("inventory.assignedToPlaceholder")} />
          </Field>
          <Field label={t("inventory.status")}>
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="ACTIVE">{t("inventory.statusActive")}</option>
              <option value="MAINTENANCE">{t("inventory.statusMaintenance")}</option>
              <option value="INACTIVE">{t("inventory.statusInactive")}</option>
              <option value="DISPOSED">{t("inventory.statusDisposed")}</option>
            </Select>
          </Field>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {asset ? t("inventory.saveChanges") : t("inventory.addAsset")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ================= Main page ================= */

type InvTab = "overview" | "stock" | "assets" | "transactions";

const TABS: { id: InvTab; labelKey: string; icon: React.ReactNode }[] = [
  { id: "overview", labelKey: "inventory.tabOverview", icon: <Package className="h-4 w-4" /> },
  { id: "stock", labelKey: "inventory.tabStock", icon: <Layers className="h-4 w-4" /> },
  { id: "assets", labelKey: "inventory.tabAssets", icon: <Boxes className="h-4 w-4" /> },
  { id: "transactions", labelKey: "inventory.tabTransactions", icon: <RefreshCw className="h-4 w-4" /> },
];

function InventoryDashboard() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";

  const has = (p: string) =>
    !!user &&
    (user.isSuperAdmin ||
      user.roleName === "SUPER_ADMIN" ||
      user.roleName === "SCHOOL_ADMIN" ||
      user.permissions?.includes(p) ||
      false);

  const canView = has("inventory.view");
  const canCreate = has("inventory.create");
  const canEdit = has("inventory.edit");
  const canSeeDepartments = has("hr.view");

  const [tab, setTab] = useState<InvTab>("overview");
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const schoolId = isSuperAdmin ? selectedSchoolId : user?.schoolId || "";

  const [itemModal, setItemModal] = useState<{ open: boolean; item?: InventoryItem }>({ open: false });
  const [assetModal, setAssetModal] = useState<{ open: boolean; asset?: InventoryAsset }>({ open: false });
  const [movementModal, setMovementModal] = useState<{ open: boolean; item?: InventoryItem }>({ open: false });
  const [itemSearch, setItemSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [txFilter, setTxFilter] = useState("");

  const queryClient = useQueryClient();

  const schoolsQuery = useQuery({
    queryKey: ["inv-schools"],
    queryFn: async () => {
      const res = await api.get("/schools", { params: { limit: 100 } });
      return res.data.data as SchoolOption[];
    },
    enabled: isSuperAdmin,
  });

  const schools = schoolsQuery.data || [];

  const statsQuery = useQuery({
    queryKey: ["inv-stats", schoolId],
    queryFn: async () => {
      const res = await api.get("/inventory/dashboard", { params: schoolId ? { schoolId } : {} });
      return res.data.data as InventoryStats;
    },
    enabled: canView,
  });

  const itemsQuery = useQuery({
    queryKey: ["inv-items", schoolId],
    queryFn: async () => {
      const res = await api.get("/inventory/items", { params: schoolId ? { schoolId } : {} });
      return res.data.data as InventoryItem[];
    },
    enabled: canView,
  });

  const assetsQuery = useQuery({
    queryKey: ["inv-assets", schoolId],
    queryFn: async () => {
      const res = await api.get("/inventory/assets", { params: schoolId ? { schoolId } : {} });
      return res.data.data as InventoryAsset[];
    },
    enabled: canView,
  });

  const transactionsQuery = useQuery({
    queryKey: ["inv-transactions", schoolId],
    queryFn: async () => {
      const res = await api.get("/inventory/transactions", { params: schoolId ? { schoolId } : {} });
      return res.data.data as InvTx[];
    },
    enabled: canView,
  });

  const staffDepartmentsQuery = useQuery({
    queryKey: ["inv-hr-departments", schoolId],
    queryFn: async () => {
      const res = await api.get("/hr/departments", { params: schoolId ? { schoolId } : {} });
      return (res.data.data as { name: string }[]).map((d) => d.name);
    },
    enabled: canSeeDepartments,
  });

  const stats = statsQuery.data;
  const items = itemsQuery.data || [];
  const assets = assetsQuery.data || [];
  const transactions = transactionsQuery.data || [];

  const allDepartments = useMemo(() => {
    const fromItems = new Set(items.map((i) => i.department).filter(Boolean) as string[]);
    (staffDepartmentsQuery.data || []).forEach((d) => fromItems.add(d));
    const fromStats = (stats?.byDepartment || []).map((d) => d.department);
    fromStats.forEach((d) => fromItems.add(d));
    return Array.from(fromItems).sort();
  }, [items, staffDepartmentsQuery.data, stats]);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    (stats?.byCategory || []).forEach((c) => set.add(c.category));
    return Array.from(set).sort();
  }, [items, stats]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["inv-stats"] });
    queryClient.invalidateQueries({ queryKey: ["inv-items"] });
    queryClient.invalidateQueries({ queryKey: ["inv-assets"] });
    queryClient.invalidateQueries({ queryKey: ["inv-transactions"] });
  };

  const saveItemMutation = useMutation({
    mutationFn: async ({ item, data }: { item?: InventoryItem; data: any }) => {
      if (item) await api.put(`/inventory/items/${item.id}`, data);
      else await api.post("/inventory/items", data);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.item ? t("inventory.itemUpdated") : t("inventory.itemAdded"));
      setItemModal({ open: false });
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/inventory/items/${id}`),
    onSuccess: () => { toast.success(t("inventory.itemRemoved")); invalidateAll(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const saveAssetMutation = useMutation({
    mutationFn: async ({ asset, data }: { asset?: InventoryAsset; data: any }) => {
      if (asset) await api.put(`/inventory/assets/${asset.id}`, data);
      else await api.post("/inventory/assets", data);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.asset ? t("inventory.assetUpdated") : t("inventory.assetAdded"));
      setAssetModal({ open: false });
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/inventory/assets/${id}`),
    onSuccess: () => { toast.success(t("inventory.assetRemoved")); invalidateAll(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const movementMutation = useMutation({
    mutationFn: async (data: { itemId: string; type: string; quantity: number; note?: string | null }) =>
      api.post("/inventory/transactions", data),
    onSuccess: () => { toast.success(t("inventory.movementRecorded")); setMovementModal({ open: false }); invalidateAll(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return items.filter((i) => {
      if (q && ![i.name, i.code, i.category, i.department, i.location].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))) {
        return false;
      }
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (deptFilter && i.department !== deptFilter) return false;
      return true;
    });
  }, [items, itemSearch, categoryFilter, deptFilter]);

  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      [a.name, a.assetCode, a.category, a.serialNumber, a.location, a.department, a.assignedTo]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [assets, assetSearch]);

  const filteredTxs = useMemo(() => {
    if (!txFilter) return transactions;
    return transactions.filter((t) => t.type === txFilter);
  }, [transactions, txFilter]);

  const lowStockItems = useMemo(
    () => items.filter((i) => i.quantity <= i.minStock).sort((a, b) => a.quantity - b.quantity),
    [items]
  );

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">{t("inventory.noAccess")}</p>
        </div>
      </div>
    );
  }

  const maxDept = Math.max(1, ...(stats?.byDepartment || []).map((d) => d.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("inventory.title")}</h1>
          <p className="text-sm text-slate-500">{t("inventory.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <Select value={selectedSchoolId} onChange={(e) => setSelectedSchoolId(e.target.value)} className="w-56">
              <option value="">{t("inventory.allSchools")}</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.schoolCode})</option>
              ))}
            </Select>
          )}
          {tab === "stock" && canCreate && (
            <Button onClick={() => setItemModal({ open: true })}>
              <Plus className="mr-2 h-4 w-4" />{t("inventory.addItem")}
            </Button>
          )}
          {tab === "assets" && canCreate && (
            <Button onClick={() => setAssetModal({ open: true })}>
              <Plus className="mr-2 h-4 w-4" />{t("inventory.addAsset")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === tb.id ? "bg-primary-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tb.icon}
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title={t("inventory.statStockItems")} value={String(stats?.totalItems ?? 0)} icon={<Layers className="h-5 w-5" />} iconBg="bg-blue-50 text-blue-600" />
            <StatCard title={t("inventory.statCategories")} value={String(stats?.categories ?? 0)} icon={<Boxes className="h-5 w-5" />} iconBg="bg-purple-50 text-purple-600" />
            <StatCard title={t("inventory.statLowOut")} value={String((stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0))} change={stats?.outOfStock ? t("inventory.outOfStockCount", { count: String(stats.outOfStock) }) : undefined} icon={<TrendingDown className="h-5 w-5" />} iconBg="bg-amber-50 text-amber-600" />
            <StatCard title={t("inventory.statStockValue")} value={cur(stats?.totalValue)} change={t("inventory.registeredAssets", { count: String(stats?.assetsCount ?? 0) })} icon={<Wallet className="h-5 w-5" />} iconBg="bg-green-50 text-green-600" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t("inventory.recentMovements")}</CardTitle>
                  <CardDescription>{t("inventory.recentMovementsDesc")}</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setTab("transactions")}>{t("inventory.viewAll")}</Button>
              </CardHeader>
              <CardContent>
                {statsQuery.isLoading ? (
                  <LoadingState label={t("inventory.loadingMovements")} />
                ) : statsQuery.isError ? (
                  <ErrorState message={t("inventory.failedMovements")} onRetry={() => statsQuery.refetch()} />
                ) : (stats?.recentTransactions || []).length === 0 ? (
                  <EmptyState title={t("inventory.noMovements")} description={t("inventory.noMovementsDesc")} />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("inventory.colItem")}</TableHead>
                          <TableHead>{t("inventory.colType")}</TableHead>
                          <TableHead>{t("inventory.colQty")}</TableHead>
                          <TableHead>{t("inventory.colNote")}</TableHead>
                          <TableHead>{t("inventory.colWhen")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats?.recentTransactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell>
                              <p className="font-medium text-slate-800">{tx.item.name}</p>
                              <p className="text-xs text-slate-400">{tx.item.code}</p>
                            </TableCell>
                            <TableCell>{txBadge(tx.type, t)}</TableCell>
                            <TableCell className="font-semibold text-slate-700">{tx.type === "OUT" ? "−" : tx.type === "IN" ? "+" : ""}{tx.quantity} {tx.item.unit}</TableCell>
                            <TableCell className="max-w-[180px] truncate text-slate-500">{tx.note || "—"}</TableCell>
                            <TableCell className="text-slate-500">{fmtDt(tx.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("inventory.stockByDept")}</CardTitle>
                <CardDescription>{t("inventory.stockByDeptDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {statsQuery.isLoading ? (
                  <LoadingState label={t("inventory.loading")} />
                ) : (stats?.byDepartment || []).length === 0 ? (
                  <EmptyState title={t("inventory.noDeptStock")} description={t("inventory.noDeptStockDesc")} />
                ) : (
                  <div className="space-y-3">
                    {(stats?.byDepartment || []).slice(0, 7).map((d) => (
                      <div key={d.department}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">{d.department}</span>
                          <span className="text-xs text-slate-400">{t("inventory.itemCount_plural", { count: String(d.count) })}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-primary-500"
                            style={{ width: `${Math.round((d.count / maxDept) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {(stats?.byDepartment || []).length > 7 && (
                      <p className="text-xs text-slate-400">{t("inventory.moreDepartments", { count: String(stats!.byDepartment.length - 7) })}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-base">{t("inventory.lowOutAlerts")}</CardTitle>
              </div>
              <CardDescription>{t("inventory.lowOutDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {itemsQuery.isLoading ? (
                <LoadingState label={t("inventory.loadingStock")} />
              ) : lowStockItems.length === 0 ? (
                <EmptyState title={t("inventory.allStockedUp")} description={t("inventory.allStockedUpDesc")} />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("inventory.colItem")}</TableHead>
                        <TableHead>{t("inventory.colDepartment")}</TableHead>
                        <TableHead>{t("inventory.colAvailable")}</TableHead>
                        <TableHead>{t("inventory.colReorderLevel")}</TableHead>
                        <TableHead>{t("inventory.colStatus")}</TableHead>
                        {canEdit && <TableHead className="text-right">{t("inventory.colActions")}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStockItems.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>
                            <p className="font-medium text-slate-800">{i.name}</p>
                            <p className="text-xs text-slate-400">{i.code} · {i.category}</p>
                          </TableCell>
                          <TableCell className="text-slate-600">{i.department || "—"}</TableCell>
                          <TableCell className={`font-semibold ${i.quantity === 0 ? "text-red-600" : "text-amber-600"}`}>{i.quantity} {i.unit}</TableCell>
                          <TableCell className="text-slate-500">{i.minStock} {i.unit}</TableCell>
                          <TableCell>{stockBadge(i.stockStatus, t)}</TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" onClick={() => setMovementModal({ open: true, item: i })}>
                                <Plus className="mr-1 h-3.5 w-3.5" />{t("inventory.stockIn")}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === "stock" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">{t("inventory.stockItems")}</CardTitle>
                <CardDescription>{t("inventory.stockItemsDesc")}</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder={t("inventory.searchItems")}
                    className="pl-9 sm:w-56"
                  />
                </div>
                <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="sm:w-40">
                  <option value="">{t("inventory.allCategories")}</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="sm:w-44">
                  <option value="">{t("inventory.allDepartments")}</option>
                  {allDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {itemsQuery.isLoading ? (
              <LoadingState label={t("inventory.loadingItems")} />
            ) : itemsQuery.isError ? (
              <ErrorState message={t("inventory.failedItems")} onRetry={() => itemsQuery.refetch()} />
            ) : filteredItems.length === 0 ? (
              <EmptyState title={itemSearch || categoryFilter || deptFilter ? t("inventory.noMatchingItems") : t("inventory.noStockItems")} description={itemSearch || categoryFilter || deptFilter ? t("inventory.tryDifferentFilters") : t("inventory.addFirstItem")} action={!itemSearch && !categoryFilter && !deptFilter && canCreate ? <Button onClick={() => setItemModal({ open: true })}><Plus className="mr-2 h-4 w-4" />{t("inventory.addItem")}</Button> : undefined} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("inventory.colItem")}</TableHead>
                      <TableHead>{t("inventory.colDepartment")}</TableHead>
                      <TableHead>{t("inventory.colAvailable")}</TableHead>
                      <TableHead>{t("inventory.colValue")}</TableHead>
                      <TableHead>{t("inventory.colMovements")}</TableHead>
                      <TableHead>{t("inventory.colStatus")}</TableHead>
                      {canEdit && <TableHead className="text-right">{t("inventory.colActions")}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          <p className="font-medium text-slate-800">{i.name}</p>
                          <p className="text-xs text-slate-400">{i.code} · {i.category} {i.location ? `· ${i.location}` : ""}</p>
                        </TableCell>
                        <TableCell>
                          {i.department ? <Badge variant="outline">{i.department}</Badge> : <span className="text-slate-400">—</span>}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-700">{i.quantity} <span className="text-xs font-normal text-slate-400">{i.unit}</span></TableCell>
                        <TableCell className="text-slate-600">{cur(i.purchasePrice)}({cur((i.purchasePrice ?? 0) * i.quantity)})</TableCell>
                        <TableCell className="text-slate-500">{i._count?.transactions ?? 0}</TableCell>
                        <TableCell>{stockBadge(i.stockStatus, t)}</TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" title={t("inventory.stockInOut")} onClick={() => setMovementModal({ open: true, item: i })}>
                                <ArrowDownToLine className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setItemModal({ open: true, item: i })}>
                                <Pencil className="h-4 w-4 text-slate-500" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:bg-red-50"
                                disabled={deleteItemMutation.isPending}
                                onClick={() => {
                                  if (window.confirm(t("inventory.deleteItemConfirm", { name: i.name }))) {
                                    deleteItemMutation.mutate(i.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "assets" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">{t("inventory.assetsTitle")}</CardTitle>
                <CardDescription>{t("inventory.assetsDesc")}</CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  placeholder={t("inventory.searchAssets")}
                  className="pl-9 sm:w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {assetsQuery.isLoading ? (
              <LoadingState label={t("inventory.loadingAssets")} />
            ) : assetsQuery.isError ? (
              <ErrorState message={t("inventory.failedAssets")} onRetry={() => assetsQuery.refetch()} />
            ) : filteredAssets.length === 0 ? (
              <EmptyState title={assetSearch ? t("inventory.noMatchingAssets") : t("inventory.noAssets")} description={assetSearch ? t("inventory.tryDifferentSearch") : t("inventory.registerAssetsDesc")} action={!assetSearch && canCreate ? <Button onClick={() => setAssetModal({ open: true })}><Plus className="mr-2 h-4 w-4" />{t("inventory.addAsset")}</Button> : undefined} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("inventory.colAsset")}</TableHead>
                      <TableHead>{t("inventory.colDepartment")}</TableHead>
                      <TableHead>{t("inventory.colLocation")}</TableHead>
                      <TableHead>{t("inventory.colSerial")}</TableHead>
                      <TableHead>{t("inventory.colPurchased")}</TableHead>
                      <TableHead>{t("inventory.colStatus")}</TableHead>
                      {canEdit && <TableHead className="text-right">{t("inventory.colActions")}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <p className="font-medium text-slate-800">{a.name}</p>
                          <p className="text-xs text-slate-400">{a.assetCode} · {a.category}</p>
                        </TableCell>
                        <TableCell>
                          {a.department ? <Badge variant="outline">{a.department}</Badge> : <span className="text-slate-400">—</span>}
                        </TableCell>
                        <TableCell className="text-slate-600">{a.location || "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-500">{a.serialNumber || "—"}</TableCell>
                        <TableCell className="text-slate-500">{fmtDate(a.purchaseDate)}</TableCell>
                        <TableCell>{assetStatusBadge(a, t)}</TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setAssetModal({ open: true, asset: a })}>
                                <Pencil className="h-4 w-4 text-slate-500" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:bg-red-50"
                                disabled={deleteAssetMutation.isPending}
                                onClick={() => {
                                  if (window.confirm(t("inventory.deleteAssetConfirm", { name: a.name }))) deleteAssetMutation.mutate(a.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "transactions" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">{t("inventory.movementsTitle")}</CardTitle>
                <CardDescription>{t("inventory.movementsDesc")}</CardDescription>
              </div>
              <Select value={txFilter} onChange={(e) => setTxFilter(e.target.value)} className="w-44">
                <option value="">{t("inventory.allMovements")}</option>
                <option value="IN">{t("inventory.txIn")}</option>
                <option value="OUT">{t("inventory.txOut")}</option>
                <option value="ADJUST">{t("inventory.adjustments")}</option>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {transactionsQuery.isLoading ? (
              <LoadingState label={t("inventory.loadingTx")} />
            ) : transactionsQuery.isError ? (
              <ErrorState message={t("inventory.failedTx")} onRetry={() => transactionsQuery.refetch()} />
            ) : filteredTxs.length === 0 ? (
              <EmptyState title={txFilter ? t("inventory.noMovementsOfType") : t("inventory.noTxYet")} description={txFilter ? t("inventory.tryAnotherFilter") : t("inventory.recordLedgerDesc")} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("inventory.colItem")}</TableHead>
                      <TableHead>{t("inventory.colType")}</TableHead>
                      <TableHead>{t("inventory.colQuantity")}</TableHead>
                      <TableHead>{t("inventory.colNote")}</TableHead>
                      <TableHead>{t("inventory.colWhen")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTxs.map((txItem) => (
                      <TableRow key={txItem.id}>
                        <TableCell>
                          <p className="font-medium text-slate-800">{txItem.item.name}</p>
                          <p className="text-xs text-slate-400">{txItem.item.code} · {txItem.item.category} {txItem.item.department ? `· ${txItem.item.department}` : ""}</p>
                        </TableCell>
                        <TableCell>{txBadge(txItem.type, t)}</TableCell>
                        <TableCell className="font-semibold text-slate-700">{txItem.type === "OUT" ? "−" : txItem.type === "IN" ? "+" : ""}{txItem.quantity} {txItem.item.unit}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-slate-500">{txItem.note || "—"}</TableCell>
                        <TableCell className="text-slate-500">{fmtDt(txItem.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {itemModal.open && (
        <ItemModal
          item={itemModal.item}
          departments={allDepartments}
          isSuperAdmin={isSuperAdmin}
          schools={schools}
          selectedSchoolId={selectedSchoolId || undefined}
          isLoading={saveItemMutation.isPending}
          error={saveItemMutation.error ? getErrorMessage(saveItemMutation.error) : undefined}
          onClose={() => setItemModal({ open: false })}
          onSubmit={(data) => saveItemMutation.mutate({ item: itemModal.item, data })}
        />
      )}
      {assetModal.open && (
        <AssetModal
          asset={assetModal.asset}
          departments={allDepartments}
          isSuperAdmin={isSuperAdmin}
          schools={schools}
          selectedSchoolId={selectedSchoolId || undefined}
          isLoading={saveAssetMutation.isPending}
          error={saveAssetMutation.error ? getErrorMessage(saveAssetMutation.error) : undefined}
          onClose={() => setAssetModal({ open: false })}
          onSubmit={(data) => saveAssetMutation.mutate({ asset: assetModal.asset, data })}
        />
      )}
      {movementModal.open && movementModal.item && (
        <MovementModal
          item={movementModal.item}
          isLoading={movementMutation.isPending}
          error={movementMutation.error ? getErrorMessage(movementMutation.error) : undefined}
          onClose={() => setMovementModal({ open: false })}
          onSubmit={(data) => movementMutation.mutate(data)}
        />
      )}
    </div>
  );
}

export default InventoryDashboard;