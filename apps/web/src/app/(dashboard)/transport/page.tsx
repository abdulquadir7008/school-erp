"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bus,
  BusFront,
  Clock,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Pencil,
  Trash2,
  Users,
  Gauge,
  Loader2,
  X,
  ShieldAlert,
  Flag,
  Route as RouteIcon,
  UserRound,
  School,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

interface StopInfo {
  id: string;
  name: string;
  position: number;
  time?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

interface DriverInfo {
  id: string;
  name: string;
  phone?: string | null;
  licenseNo?: string | null;
}

interface VehicleInfo {
  id: string;
  registrationNo: string;
  type?: string | null;
  capacity?: number | null;
  status?: string | null;
  schoolId?: string;
  seatsAvailable?: number;
  driver?: DriverInfo | null;
  _count?: { routes: number; assignments: number };
}

interface RouteSummary {
  id: string;
  name: string;
  startTime?: string | null;
  endTime?: string | null;
  stopsCount: number;
  studentsCount: number;
  vehicle: VehicleInfo;
  driver?: DriverInfo | null;
  stops: StopInfo[];
  occupancy: number;
}

interface TransportStats {
  vehicles: number;
  activeVehicles: number;
  drivers: number;
  routes: RouteSummary[];
  assignedStudents: number;
  totalCapacity: number;
  seatUtilization: number;
}

interface TransportRoute {
  id: string;
  name: string;
  startTime?: string | null;
  endTime?: string | null;
  vehicleId: string;
  schoolId?: string;
  vehicle: VehicleInfo;
  stops: StopInfo[];
  _count: { assignments: number };
}

interface TransportDriver {
  id: string;
  name: string;
  phone: string;
  licenseNo?: string | null;
  schoolId?: string;
  vehicleId?: string | null;
  vehicle?: { id: string; registrationNo: string } | null;
}

interface TransportAssignment {
  id: string;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string; class?: { name: string } | null };
  route: { id: string; name: string; startTime?: string | null; endTime?: string | null };
  vehicle: { id: string; registrationNo: string; type?: string | null; capacity?: number | null };
  stop: StopInfo | null;
}

interface MyChildTransport {
  student: { id: string; firstName: string; lastName: string; admissionNumber: string; className?: string | null; sectionName?: string | null };
  vehicle: VehicleInfo;
  route: { id: string; name: string; startTime?: string | null; endTime?: string | null };
  driver: DriverInfo | null;
  pickupStop: StopInfo | null;
  schoolStop: StopInfo | null;
  stops: StopInfo[];
}

interface MyTransport {
  children: MyChildTransport[];
  emergencyContact: { schoolName: string; schoolPhone: string; schoolEmail: string } | null;
}

interface StudentOption {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
}

/* ================= Helpers ================= */

function formatTime(time?: string | null, t?: (key: string, params?: Record<string, string | number>) => string) {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const suffix = h >= 12 ? t?.("transport.pm") ?? "PM" : t?.("transport.am") ?? "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

function getJourneyStatus(startTime?: string | null, endTime?: string | null) {
  if (!startTime || !endTime) {
    return { key: "UNSCHEDULED", className: "bg-slate-100 text-slate-600" };
  }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMin = sh * 60 + (sm || 0);
  const endMin = eh * 60 + (em || 0);
  if (nowMin < startMin) return { key: "SCHEDULED", className: "bg-amber-100 text-amber-700" };
  if (nowMin <= endMin) return { key: "ON_ROUTE", className: "bg-green-100 text-green-700" };
  return { key: "AT_SCHOOL", className: "bg-blue-100 text-blue-700" };
}

const statusConfig: Record<string, { labelKey: string; className: string }> = {
  ACTIVE: { labelKey: "common.active", className: "bg-green-100 text-green-700" },
  MAINTENANCE: { labelKey: "transport.status.MAINTENANCE", className: "bg-amber-100 text-amber-700" },
  INACTIVE: { labelKey: "common.inactive", className: "bg-slate-100 text-slate-600" },
};

function num(v?: number | string | null) {
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/* ================= SVG Route Map ================= */

function RouteMap({ stops, height = 240 }: { stops: StopInfo[]; height?: number }) {
  const { t } = useI18n();
  const points = stops
    .map((s) => ({ id: s.id, name: s.name, lat: num(s.latitude), lng: num(s.longitude) }))
    .filter((p): p is { id: string; name: string; lat: number; lng: number } => p.lat !== null && p.lng !== null);

  if (points.length < 2) {
    return (
      <div className="flex h-[140px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
        <MapPin className="me-2 h-4 w-4" />
        {t("transport.mapNeedsCoordinates")}
      </div>
    );
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const W = 640;
  const H = height;
  const PAD = 42;
  const x = (lng: number) => PAD + ((lng - minLng) / (maxLng - minLng || 1)) * (W - PAD * 2);
  const y = (lat: number) => PAD + ((maxLat - lat) / (maxLat - minLat || 1)) * (H - PAD * 2);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.lng).toFixed(1)},${y(p.lat).toFixed(1)}`)
    .join(" ");

  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-slate-200 bg-gradient-to-br from-sky-50 to-emerald-50">
      <rect width={W} height={H} fill="transparent" />
      <path d={line} fill="none" stroke="#0f766e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      {points.map((p, i) => {
        const isStart = i === 0;
        const isSchool = i === points.length - 1;
        const cx = x(p.lng);
        const cy = y(p.lat);
        return (
          <g key={p.id}>
            <circle cx={cx} cy={cy} r={isSchool ? 11 : 9} fill={isSchool ? "#059669" : isStart ? "#2563eb" : "#fff"} stroke={isSchool ? "#047857" : isStart ? "#1d4ed8" : "#0f766e"} strokeWidth={2.5} />
            <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="700" fill={isStart || isSchool ? "#fff" : "#0f766e"}>
              {i + 1}
            </text>
            <text x={cx} y={cy - 14} textAnchor="middle" fontSize="11" fontWeight="600" fill="#334155">
              {p.name}
            </text>
          </g>
        );
      })}
      <g>
        <circle cx={x(last.lng)} cy={y(last.lat)} r="16" fill="none" stroke="#059669" strokeWidth="2" opacity="0.5" />
        <circle cx={x(last.lng)} cy={y(last.lat)} r="22" fill="none" stroke="#059669" strokeWidth="1.5" opacity="0.25" />
      </g>
    </svg>
  );
}

/* ================= Main Page ================= */

export default function TransportPage() {
  const user = useAuthStore((s) => s.user);
  const roleName = user?.roleName || "";
  const isPersonal = roleName === "PARENT" || roleName === "STUDENT";

  if (isPersonal) return <MyBusView />;
  return <FleetDashboard />;
}

/* ================= Parent / Student: My Bus ================= */

function MyBusView() {
  const user = useAuthStore((s) => s.user);
  const roleName = user?.roleName || "";
  const { t } = useI18n();

  const myQuery = useQuery({
    queryKey: ["transport-my"],
    queryFn: async () => {
      const res = await api.get("/transport/my");
      return res.data.data as MyTransport;
    },
  });

  const data = myQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t("transport.myBus")}</h1>
        <p className="text-sm text-slate-500">
          {roleName === "STUDENT" ? t("transport.myBusStudentSubtitle") : t("transport.myBusParentSubtitle")}
        </p>
      </div>

      {myQuery.isLoading ? (
        <LoadingState label={t("transport.loadingRouteDetails")} />
      ) : myQuery.isError ? (
        <ErrorState message={t("transport.loadRouteFailed")} onRetry={() => myQuery.refetch()} />
      ) : !data || !data.children.length ? (
        <EmptyState
          title={t("transport.noBusAssigned")}
          description={t("transport.noBusAssignedDesc")}
        />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            {data.children.map((c) => {
              const jStatus = getJourneyStatus(c.route.startTime, c.route.endTime);
              return (
                <div key={c.student.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {/* Student header */}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-emerald-600 text-white">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {c.student.firstName} {c.student.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {[c.student.className, c.student.sectionName].filter(Boolean).join(" · ") || c.student.admissionNumber}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${jStatus.className}`}>
                      {jStatus.key === "ON_ROUTE" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />}
                      {t(`transport.journey.${jStatus.key}`)}
                    </span>
                  </div>

                  {/* Vehicle hero */}
                  <div className="relative overflow-hidden px-5 py-5">
                    <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-teal-50" />
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-md">
                        <BusFront className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg font-semibold text-slate-900">{c.route.name}</p>
                        <p className="text-sm text-slate-500">{c.vehicle.registrationNo} · {c.vehicle.type || "Bus"}</p>
                      </div>
                      <div className="ms-auto text-end">
                        <p className="text-xs text-slate-500">{t("transport.timing")}</p>
                        <p className="text-sm font-semibold text-slate-800">
                          {formatTime(c.route.startTime, t)} – {formatTime(c.route.endTime, t)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <p className="text-[11px] text-slate-500">{t("transport.capacity")}</p>
                        <p className="text-sm font-semibold text-slate-800">{c.vehicle.capacity ?? "—"}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <p className="text-[11px] text-slate-500">{t("transport.seatsLeft")}</p>
                        <p className="text-sm font-semibold text-teal-700">{c.vehicle.seatsAvailable ?? "—"}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <p className="text-[11px] text-slate-500">{t("transport.vehicleStatus")}</p>
                        <p className="text-sm font-semibold text-slate-800">
                          {statusConfig[c.vehicle.status || "ACTIVE"]?.labelKey ? t(statusConfig[c.vehicle.status || "ACTIVE"].labelKey) : c.vehicle.status}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Route map */}
                  <div className="px-5 pb-1">
                    <RouteMap stops={c.stops} height={200} />
                  </div>

                  {/* Stop timeline */}
                  <div className="px-5 py-4">
                    <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <RouteIcon className="h-4 w-4 text-teal-600" />
                      {t("transport.stops")} {c.pickupStop && <span className="text-xs font-normal text-slate-400">· {t("transport.pickupAt", { name: c.pickupStop.name })}</span>}
                    </p>
                    <div className="space-y-1">
                      {c.stops.map((s, i) => {
                        const isPickup = c.pickupStop?.id === s.id;
                        const isSchool = c.schoolStop?.id === s.id || s.position === c.stops.length - 1;
                        return (
                          <div key={s.id} className="relative flex items-start gap-3 ps-6">
                            <span
                              className={`absolute start-0 top-2.5 h-2.5 w-2.5 rounded-full border-2 ${
                                isPickup
                                  ? "border-blue-600 bg-blue-500"
                                  : isSchool
                                  ? "border-emerald-600 bg-emerald-500"
                                  : "border-teal-600 bg-white"
                              }`}
                            />
                            {i < c.stops.length - 1 && <span className="absolute start-[4px] top-6 h-full w-px bg-slate-200" />}
                            <div
                              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                                isPickup ? "bg-blue-50/80" : isSchool ? "bg-emerald-50/80" : ""
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-800">{s.name}</span>
                                {isPickup && <Badge variant="default" className="bg-blue-600 text-white">{t("transport.pickup")}</Badge>}
                                {isSchool && <Badge variant="success">{t("transport.school")}</Badge>}
                              </div>
                              <span className="shrink-0 text-xs font-medium text-slate-500">{formatTime(s.time, t)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Driver card */}
                  <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
                      <Navigation className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{c.driver?.name || t("transport.driverAssigned")}</p>
                      <p className="truncate text-xs text-slate-500">
                        {c.driver
                          ? [c.driver.phone, c.driver.licenseNo ? t("transport.licenseNo", { license: c.driver.licenseNo }) : ""].filter(Boolean).join(" · ")
                          : t("transport.driverDetailsPlaceholder")}
                      </p>
                    </div>
                    {c.driver?.phone && (
                      <Button variant="outline" size="sm" onClick={() => window.open(`tel:${c.driver?.phone}`)}>
                        <Phone className="me-1.5 h-3.5 w-3.5" />
                        {t("transport.call")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Emergency contact */}
          {data.emergencyContact && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900">{t("transport.emergencyTitle", { schoolName: data.emergencyContact.schoolName })}</p>
                  <p className="text-xs text-amber-700">
                    {t("transport.emergencyDesc")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.emergencyContact?.schoolPhone && (
                    <Button size="sm" variant="outline" className="border-amber-300 bg-white text-amber-800" onClick={() => window.open(`tel:${data.emergencyContact?.schoolPhone}`)}>
                      <Phone className="me-1.5 h-3.5 w-3.5" />
                      {data.emergencyContact?.schoolPhone}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ================= Admin: Fleet Dashboard ================= */

type FleetTab = "routes" | "vehicles" | "drivers" | "assignments";

function FleetDashboard() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.isSuperAdmin || user?.roleName === "SUPER_ADMIN";
  const canEdit =
    isSuperAdmin ||
    user?.roleName === "SCHOOL_ADMIN" ||
    user?.roleName === "PRINCIPAL" ||
    user?.roleName === "TRANSPORT_MANAGER";
  const { t } = useI18n();

  const [tab, setTab] = useState<FleetTab>("routes");
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const schoolId = isSuperAdmin ? selectedSchoolId : user?.schoolId || "";
  const [vehicleModal, setVehicleModal] = useState<{ open: boolean; vehicle?: VehicleInfo }>({ open: false });
  const [driverModal, setDriverModal] = useState<{ open: boolean; driver?: TransportDriver }>({ open: false });
  const [routeModal, setRouteModal] = useState<{ open: boolean; route?: TransportRoute }>({ open: false });
  const [assignmentModal, setAssignmentModal] = useState(false);
  const [routeDetail, setRouteDetail] = useState<{ open: boolean; routeId?: string }>({ open: false });
  const [assignmentSearch, setAssignmentSearch] = useState("");

  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ["transport-dashboard", schoolId],
    queryFn: async () => {
      const res = await api.get("/transport/dashboard", { params: schoolId ? { schoolId } : {} });
      return res.data.data as TransportStats;
    },
  });

  const vehiclesQuery = useQuery({
    queryKey: ["transport-vehicles", schoolId],
    queryFn: async () => {
      const res = await api.get("/transport/vehicles", { params: schoolId ? { schoolId } : {} });
      return res.data.data as VehicleInfo[];
    },
  });

  const driversQuery = useQuery({
    queryKey: ["transport-drivers", schoolId],
    queryFn: async () => {
      const res = await api.get("/transport/drivers", { params: schoolId ? { schoolId } : {} });
      return res.data.data as TransportDriver[];
    },
  });

  const routesQuery = useQuery({
    queryKey: ["transport-routes", schoolId],
    queryFn: async () => {
      const res = await api.get("/transport/routes", { params: schoolId ? { schoolId } : {} });
      return res.data.data as TransportRoute[];
    },
  });

  const assignmentsQuery = useQuery({
    queryKey: ["transport-assignments", schoolId],
    queryFn: async () => {
      const res = await api.get("/transport/assignments", { params: schoolId ? { schoolId } : {} });
      return res.data.data as TransportAssignment[];
    },
  });

  const schoolsQuery = useQuery({
    queryKey: ["transport-schools"],
    queryFn: async () => {
      const res = await api.get("/schools", { params: { limit: 100 } });
      return res.data.data as { id: string; name: string; schoolCode: string }[];
    },
    enabled: isSuperAdmin,
  });

  const studentsQuery = useQuery({
    queryKey: ["transport-students", schoolId],
    queryFn: async () => {
      const res = await api.get("/students", {
        params: { limit: 60, ...(schoolId ? { schoolId } : {}) },
      });
      return res.data.data as StudentOption[];
    },
    enabled: assignmentModal,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["transport-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["transport-vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["transport-drivers"] });
    queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
    queryClient.invalidateQueries({ queryKey: ["transport-assignments"] });
  };

  const saveVehicleMutation = useMutation({
    mutationFn: async ({ vehicle, data }: { vehicle?: VehicleInfo; data: any }) => {
      if (vehicle) await api.put(`/transport/vehicles/${vehicle.id}`, data);
      else await api.post("/transport/vehicles", data);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.vehicle ? t("transport.vehicleUpdated") : t("transport.vehicleAdded"));
      setVehicleModal({ open: false });
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/transport/vehicles/${id}`),
    onSuccess: () => { toast.success(t("transport.vehicleRemoved")); setVehicleModal({ open: false }); invalidateAll(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const saveDriverMutation = useMutation({
    mutationFn: async ({ driver, data }: { driver?: TransportDriver; data: any }) => {
      if (driver) await api.put(`/transport/drivers/${driver.id}`, data);
      else await api.post("/transport/drivers", data);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.driver ? t("transport.driverUpdated") : t("transport.driverAdded"));
      setDriverModal({ open: false });
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteDriverMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/transport/drivers/${id}`),
    onSuccess: () => { toast.success(t("transport.driverRemoved")); setDriverModal({ open: false }); invalidateAll(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const saveRouteMutation = useMutation({
    mutationFn: async ({ route, data }: { route?: TransportRoute; data: any }) => {
      let vehicleId = data.vehicleId;
      if (!vehicleId) {
        const number = (data.vehicleNumber || "").trim().toUpperCase();
        const listRes = await api.get("/transport/vehicles", {
          params: { schoolId: data.schoolId || undefined },
        });
        let match = (listRes.data.data as VehicleInfo[]).find(
          (v) => v.registrationNo.toUpperCase() === number
        );
        if (!match) {
          const created = await api.post("/transport/vehicles", {
            registrationNo: number,
            type: (data.vehicleName || "").trim() || "Bus",
            schoolId: data.schoolId || undefined,
          });
          match = created.data.data as VehicleInfo;
        }
        vehicleId = match.id;
      }

      const payload = {
        name: data.name,
        vehicleId,
        startTime: data.startTime || undefined,
        endTime: data.endTime || undefined,
        ...(data.schoolId ? { schoolId: data.schoolId } : {}),
      };
      if (route) await api.put(`/transport/routes/${route.id}`, payload);
      else await api.post("/transport/routes", payload);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.route ? t("transport.routeUpdated") : t("transport.routeCreated"));
      setRouteModal({ open: false });
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/transport/routes/${id}`),
    onSuccess: () => { toast.success(t("transport.routeRemoved")); setRouteModal({ open: false }); invalidateAll(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: any) => api.post("/transport/assignments", data),
    onSuccess: () => {
      toast.success(t("transport.assignedToast"));
      setAssignmentModal(false);
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/transport/assignments/${id}`),
    onSuccess: () => { toast.success(t("transport.assignmentRemoved")); invalidateAll(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const stats = statsQuery.data;
  const routesForDisplay = stats?.routes || [];
  const vehicles = vehiclesQuery.data || [];
  const drivers = driversQuery.data || [];
  const assignments = assignmentsQuery.data || [];

  const filteredAssignments = useMemo(() => {
    const q = assignmentSearch.toLowerCase();
    if (!q) return assignments;
    return assignments.filter(
      (a) =>
        `${a.student.firstName} ${a.student.lastName}`.toLowerCase().includes(q) ||
        a.student.admissionNumber.toLowerCase().includes(q) ||
        a.route.name.toLowerCase().includes(q) ||
        a.vehicle.registrationNo.toLowerCase().includes(q)
    );
  }, [assignments, assignmentSearch]);

  const tabItems: { key: FleetTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "routes", label: t("transport.routes"), icon: <RouteIcon className="h-4 w-4" />, count: stats?.routes.length },
    { key: "vehicles", label: t("transport.vehicles"), icon: <Bus className="h-4 w-4" />, count: vehicles.length },
    { key: "drivers", label: t("transport.drivers"), icon: <Navigation className="h-4 w-4" />, count: drivers.length },
    { key: "assignments", label: t("transport.assignments"), icon: <Users className="h-4 w-4" />, count: assignments.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("nav.route")}</h1>
          <p className="text-sm text-slate-500">{t("transport.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button
              onClick={() => setAssignmentModal(true)}
              disabled={isSuperAdmin && !schoolId}
              title={isSuperAdmin && !schoolId ? t("transport.selectSchoolToAssign") : undefined}
            >
              <Plus className="me-2 h-4 w-4" />{t("transport.assignStudent")}
            </Button>
          )}
          {canEdit && tab === "vehicles" && (
            <Button onClick={() => setVehicleModal({ open: true })}>
              <Plus className="me-2 h-4 w-4" />{t("transport.addVehicle")}
            </Button>
          )}
          {canEdit && tab === "drivers" && (
            <Button onClick={() => setDriverModal({ open: true })}>
              <Plus className="me-2 h-4 w-4" />{t("transport.addDriver")}
            </Button>
          )}
          {canEdit && tab === "routes" && (
            <Button onClick={() => setRouteModal({ open: true })}>
              <Plus className="me-2 h-4 w-4" />{t("transport.addRoute")}
            </Button>
          )}
        </div>
      </div>

      {/* School filter for super admin */}
      {isSuperAdmin && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <School className="h-4 w-4 text-slate-400" />
          <label className="text-sm font-medium text-slate-700">{t("transport.school")}</label>
          <Select
            className="w-72"
            value={selectedSchoolId}
            onChange={(e) => {
              setSelectedSchoolId(e.target.value);
              setTab("routes");
            }}
          >
            <option value="">{t("transport.allSchools")}</option>
            {(schoolsQuery.data || []).map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.schoolCode})</option>
            ))}
          </Select>
          {selectedSchoolId && (
            <span className="text-xs text-slate-500">
              {t("transport.showingSelectedSchoolOnly")}
            </span>
          )}
          {!selectedSchoolId && (
            <span className="text-xs text-slate-500">
              {t("transport.showingAllSchools")}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("transport.vehicles")}
          value={String(stats?.vehicles ?? 0)}
          change={t("transport.activeInFleet", { n: stats?.activeVehicles ?? 0 })}
          icon={<Bus className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-600"
        />
        <StatCard
          title={t("transport.routes")}
          value={String(stats?.routes.length ?? 0)}
          change={t("transport.totalSeats", { n: stats?.totalCapacity ?? 0 })}
          icon={<RouteIcon className="h-5 w-5" />}
          iconBg="bg-green-50 text-green-600"
        />
        <StatCard
          title={t("transport.studentsAssigned")}
          value={String(stats?.assignedStudents ?? 0)}
          change={t("transport.seatUtilization", { n: stats?.seatUtilization ?? 0 })}
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-purple-50 text-purple-600"
        />
        <StatCard
          title={t("transport.drivers")}
          value={String(stats?.drivers ?? 0)}
          change={stats && stats.routes.length > stats.drivers ? t("transport.unassignedRouteDrivers") : t("transport.allRoutesCovered")}
          icon={<Navigation className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {tabItems.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              tab === t.key ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.icon}
            {t.label}
            {typeof t.count === "number" && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${tab === t.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ---------------- Routes tab ---------------- */}
      {tab === "routes" &&
        (statsQuery.isLoading ? (
          <LoadingState label={t("transport.loadingRoutes")} />
        ) : statsQuery.isError ? (
          <ErrorState message={t("transport.loadRouteDataFailed")} onRetry={() => statsQuery.refetch()} />
        ) : routesForDisplay.length === 0 ? (
          <EmptyState
            title={t("transport.noRoutesYet")}
            description={t("transport.noRoutesYetDesc")}
            action={canEdit ? <Button onClick={() => setRouteModal({ open: true })}><Plus className="me-2 h-4 w-4" />{t("transport.addRoute")}</Button> : undefined}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {routesForDisplay.map((r) => {
              const jStatus = getJourneyStatus(r.startTime, r.endTime);
              return (
                <div key={r.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white">
                        <RouteIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{r.name}</p>
                        <p className="text-xs text-slate-500">
                          <Clock className="me-1 inline h-3 w-3 text-slate-400" />
                          {formatTime(r.startTime, t)} – {formatTime(r.endTime, t)}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${jStatus.className}`}>
                      {jStatus.key === "ON_ROUTE" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />}
                      {t(`transport.journey.${jStatus.key}`)}
                    </span>
                  </div>

                  {/* Map preview */}
                  <div className="px-4 pt-4">
                    <RouteMap stops={r.stops} height={150} />
                  </div>

                  <div className="px-4 py-4">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{t("transport.stopsCount", { n: r.stopsCount })}</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-slate-400" />{t("transport.studentsCount", { n: r.studentsCount })}</span>
                      <span className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5 text-slate-400" />{t("transport.percentFull", { n: r.occupancy })}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${r.occupancy > 85 ? "bg-red-500" : r.occupancy > 60 ? "bg-amber-500" : "bg-teal-500"}`}
                        style={{ width: `${Math.min(100, r.occupancy)}%` }}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Bus className="h-4 w-4 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">{t("transport.seatsFree", { registrationNo: r.vehicle.registrationNo, seats: r.vehicle.seatsAvailable ?? "—" })}</p>
                          <p className="truncate text-[11px] text-slate-500">
                            {r.driver
                              ? t("transport.driverName", { name: r.driver.name })
                              : r.vehicle.driver
                              ? t("transport.driverName", { name: r.vehicle.driver.name })
                              : t("transport.noDriverAssigned")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setRouteDetail({ open: true, routeId: r.id })}>
                        {t("transport.viewRoute")}
                      </Button>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRouteModal({ open: true, route: routesQuery.data?.find((x) => x.id === r.id) })}
                        >
                          <Pencil className="me-1 h-3.5 w-3.5" />{t("common.edit")}
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          disabled={deleteRouteMutation.isPending}
                          onClick={() => {
                            if (window.confirm(t("transport.deleteRouteConfirm", { name: r.name }))) {
                              deleteRouteMutation.mutate(r.id);
                            }
                          }}
                        >
                          <Trash2 className="me-1 h-3.5 w-3.5" />{t("common.delete")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {/* ---------------- Vehicles tab ---------------- */}
      {tab === "vehicles" &&
        (vehiclesQuery.isLoading ? (
          <LoadingState label="Loading vehicles..." />
        ) : vehiclesQuery.isError ? (
          <ErrorState message="Failed to load vehicles" onRetry={() => vehiclesQuery.refetch()} />
        ) : vehicles.length === 0 ? (
          <EmptyState
            title="No vehicles in the fleet"
            description="Add your first vehicle to get started"
            action={canEdit ? <Button onClick={() => setVehicleModal({ open: true })}><Plus className="mr-2 h-4 w-4" />Add Vehicle</Button> : undefined}
          />
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Capacity</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-center">Routes</TableHead>
                    <TableHead className="text-center">Students</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                            <Bus className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{v.registrationNo}</p>
                            <p className="text-xs text-slate-400">ID: {v.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{v.type || "—"}</TableCell>
                      <TableCell className="text-center font-medium text-slate-800">{v.capacity ?? "—"}</TableCell>
                      <TableCell>{v.driver ? <span className="font-medium text-slate-700">{v.driver.name}</span> : <span className="text-slate-400">Unassigned</span>}</TableCell>
                      <TableCell className="text-center text-slate-600">{v._count?.routes ?? 0}</TableCell>
                      <TableCell className="text-center text-slate-600">{v._count?.assignments ?? 0}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusConfig[v.status || "ACTIVE"]?.className || "bg-slate-100 text-slate-600"}`}>
                          {statusConfig[v.status || "ACTIVE"]?.labelKey ? t(statusConfig[v.status || "ACTIVE"].labelKey) : v.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setVehicleModal({ open: true, vehicle: v })}>
                              <Pencil className="h-4 w-4 text-slate-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50"
                              disabled={deleteVehicleMutation.isPending}
                              onClick={() => {
                                const routesCount = v._count?.routes ?? 0;
                                const studentsCount = v._count?.assignments ?? 0;
                                const extra =
                                  routesCount > 0 || studentsCount > 0
                                    ? ` This will also remove ${routesCount} route(s) and unassign ${studentsCount} student(s).`
                                    : "";
                                if (window.confirm(`Remove vehicle ${v.registrationNo} from the fleet?${extra}`)) deleteVehicleMutation.mutate(v.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

      {/* ---------------- Drivers tab ---------------- */}
      {tab === "drivers" &&
        (driversQuery.isLoading ? (
          <LoadingState label="Loading drivers..." />
        ) : driversQuery.isError ? (
          <ErrorState message="Failed to load drivers" onRetry={() => driversQuery.refetch()} />
        ) : drivers.length === 0 ? (
          <EmptyState
            title="No drivers added yet"
            description="Add drivers and assign them to vehicles"
            action={canEdit ? <Button onClick={() => setDriverModal({ open: true })}><Plus className="mr-2 h-4 w-4" />Add Driver</Button> : undefined}
          />
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-center">Phone</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Assigned Vehicle</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                            <Navigation className="h-4 w-4" />
                          </div>
                          <p className="font-medium text-slate-800">{d.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-slate-600">{d.phone}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{d.licenseNo || "—"}</TableCell>
                      <TableCell>{d.vehicle ? <span className="font-medium text-slate-700">{d.vehicle.registrationNo}</span> : <span className="text-slate-400">Unassigned</span>}</TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setDriverModal({ open: true, driver: d })}>
                              <Pencil className="h-4 w-4 text-slate-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50"
                              disabled={deleteDriverMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`Remove driver ${d.name}?`)) deleteDriverMutation.mutate(d.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

      {/* ---------------- Assignments tab ---------------- */}
      {tab === "assignments" && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by student, admission no, route, or bus..."
              value={assignmentSearch}
              onChange={(e) => setAssignmentSearch(e.target.value)}
            />
          </div>
          {assignmentsQuery.isLoading ? (
            <LoadingState label="Loading assignments..." />
          ) : assignmentsQuery.isError ? (
            <ErrorState message="Failed to load assignments" onRetry={() => assignmentsQuery.refetch()} />
          ) : filteredAssignments.length === 0 ? (
            <EmptyState
              title="No student assignments"
              description="Assign students to buses to see them here"
              action={canEdit && (schoolId || !isSuperAdmin) ? (
                <Button onClick={() => setAssignmentModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />Assign Student
                </Button>
              ) : undefined}
            />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Bus</TableHead>
                      <TableHead>Pickup Stop</TableHead>
                      <TableHead>Timing</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium text-slate-800">{a.student.firstName} {a.student.lastName}</div>
                          <div className="font-mono text-xs text-slate-400">
                            {a.student.admissionNumber}{a.student.class?.name ? ` · ${a.student.class.name}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">{a.route.name}</TableCell>
                        <TableCell>
                          {a.vehicle.registrationNo}
                          <div className="text-xs text-slate-400">{a.vehicle.type || "Bus"} · {a.vehicle.capacity ?? "—"} seats</div>
                        </TableCell>
                        <TableCell>{a.stop ? <span className="text-slate-700">{a.stop.name}</span> : <span className="text-slate-400">—</span>}</TableCell>
                        <TableCell className="text-slate-600">{formatTime(a.route.startTime)} – {formatTime(a.route.endTime)}</TableCell>
                        <TableCell className="text-right">
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              disabled={deleteAssignmentMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`Remove ${a.student.firstName} ${a.student.lastName} from the bus?`)) {
                                  deleteAssignmentMutation.mutate(a.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Remove
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Modals */}
      {vehicleModal.open && (
        <VehicleModal
          vehicle={vehicleModal.vehicle}
          vehicles={vehicles}
          isSuperAdmin={isSuperAdmin}
          schools={schoolsQuery.data || []}
          selectedSchoolId={schoolId || undefined}
          isLoading={saveVehicleMutation.isPending}
          error={saveVehicleMutation.error ? getErrorMessage(saveVehicleMutation.error) : undefined}
          onClose={() => setVehicleModal({ open: false })}
          onSubmit={(data) => saveVehicleMutation.mutate({ vehicle: vehicleModal.vehicle, data })}
        />
      )}

      {driverModal.open && (
        <DriverModal
          driver={driverModal.driver}
          vehicles={vehicles}
          isSuperAdmin={isSuperAdmin}
          schools={schoolsQuery.data || []}
          selectedSchoolId={schoolId || undefined}
          isLoading={saveDriverMutation.isPending}
          error={saveDriverMutation.error ? getErrorMessage(saveDriverMutation.error) : undefined}
          onClose={() => setDriverModal({ open: false })}
          onSubmit={(data) => saveDriverMutation.mutate({ driver: driverModal.driver, data })}
        />
      )}

      {routeModal.open && (
        <RouteModal
          route={routeModal.route}
          isSuperAdmin={isSuperAdmin}
          schools={schoolsQuery.data || []}
          selectedSchoolId={schoolId || undefined}
          isLoading={saveRouteMutation.isPending}
          error={saveRouteMutation.error ? getErrorMessage(saveRouteMutation.error) : undefined}
          onClose={() => setRouteModal({ open: false })}
          onSubmit={(data) => saveRouteMutation.mutate({ route: routeModal.route, data })}
        />
      )}

      {assignmentModal && (
        <AssignmentModal
          students={studentsQuery.data || []}
          studentsLoading={studentsQuery.isLoading}
          routes={routesQuery.data || []}
          vehicles={vehicles}
          schoolId={isSuperAdmin ? schoolId || undefined : undefined}
          isLoading={createAssignmentMutation.isPending}
          error={createAssignmentMutation.error ? getErrorMessage(createAssignmentMutation.error) : undefined}
          onClose={() => setAssignmentModal(false)}
          onSubmit={(data) => createAssignmentMutation.mutate(data)}
        />
      )}

      {routeDetail.open && (
        <RouteDetailModal
          routeId={routeDetail.routeId!}
          routes={routesQuery.data || []}
          routesLoading={routesQuery.isLoading}
          canEdit={canEdit}
          onClose={() => setRouteDetail({ open: false })}
        />
      )}
    </div>
  );
}

/* ================= Route Detail Modal ================= */

function RouteDetailModal({
  routeId,
  routes,
  routesLoading,
  canEdit,
  onClose,
}: {
  routeId: string;
  routes: TransportRoute[];
  routesLoading: boolean;
  canEdit: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const route = routes.find((r) => r.id === routeId);
  const jStatus = getJourneyStatus(route?.startTime, route?.endTime);

  const [showAddStop, setShowAddStop] = useState(false);
  const [stopForm, setStopForm] = useState({
    name: "",
    time: "",
    latitude: "",
    longitude: "",
  });
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    time: "",
    position: "",
    latitude: "",
    longitude: "",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
    queryClient.invalidateQueries({ queryKey: ["transport-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["transport-assignments"] });
  };

  const saveStopMutation = useMutation({
    mutationFn: async ({ stop, data }: { stop?: StopInfo; routeId: string; data: any }) => {
      if (stop) await api.put(`/transport/stops/${stop.id}`, data);
      else await api.post(`/transport/routes/${routeId}/stops`, data);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.stop ? "Stop updated" : "Stop added");
      setShowAddStop(false);
      setStopForm({ name: "", time: "", latitude: "", longitude: "" });
      setEditingStopId(null);
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteStopMutation = useMutation({
    mutationFn: async (stopId: string) => api.delete(`/transport/stops/${stopId}`),
    onSuccess: () => {
      toast.success("Stop removed");
      setEditingStopId(null);
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const sortedStops = useMemo(
    () => (route ? [...route.stops].sort((a, b) => a.position - b.position) : []),
    [route]
  );

  const toNullableNumber = (v: string) => {
    const n = Number(v);
    if (v.trim() === "" || Number.isNaN(n)) return undefined;
    return n;
  };

  const startEdit = (stop: StopInfo) => {
    setEditingStopId(stop.id);
    setEditForm({
      name: stop.name,
      time: stop.time || "",
      position: String(stop.position),
      latitude: stop.latitude != null && stop.latitude !== "" ? String(stop.latitude) : "",
      longitude: stop.longitude != null && stop.longitude !== "" ? String(stop.longitude) : "",
    });
  };

  return (
    <ModalShell title="Route Details" subtitle={route?.name || "Loading..."} onClose={onClose}>
      <div className="space-y-4 p-6">
        {routesLoading && !route ? (
          <LoadingState label="Loading route..." />
        ) : !route ? (
          <EmptyState title="Route not found" description="This route may have been removed." />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-600 text-white">
                  <RouteIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{route.name}</p>
                  <p className="text-xs text-slate-500">Timing: {formatTime(route.startTime)} – {formatTime(route.endTime)}</p>
                </div>
              </div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${jStatus.className}`}>{t(`transport.journey.${jStatus.key}`)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center text-sm">
              <div>
                <p className="text-xs text-slate-500">Bus</p>
                <p className="font-semibold text-slate-800">{route.vehicle.registrationNo}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Driver</p>
                <p className="font-semibold text-slate-800">{route.vehicle.driver?.name || "Not assigned"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Capacity</p>
                <p className="font-semibold text-slate-800">{route.vehicle.capacity ?? "—"} seats</p>
              </div>
            </div>

            <RouteMap stops={route.stops} height={220} />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Flag className="h-4 w-4 text-teal-600" />
                  {sortedStops.length} stops
                </p>
                {canEdit && !showAddStop && (
                  <Button size="sm" variant="outline" onClick={() => setShowAddStop(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />Add Stop
                  </Button>
                )}
              </div>

              {showAddStop && (
                <form
                  className="mb-3 grid grid-cols-1 gap-3 rounded-xl border border-teal-200 bg-teal-50/40 p-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveStopMutation.mutate({
                      routeId: route.id,
                      data: {
                        name: stopForm.name.trim(),
                        time: stopForm.time || undefined,
                        latitude: toNullableNumber(stopForm.latitude),
                        longitude: toNullableNumber(stopForm.longitude),
                      },
                    });
                  }}
                >
                  <Field label="Stop Name *">
                    <Input
                      value={stopForm.name}
                      onChange={(e) => setStopForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Market Road"
                      required
                    />
                  </Field>
                  <Field label="Time">
                    <Input
                      type="time"
                      value={stopForm.time}
                      onChange={(e) => setStopForm((f) => ({ ...f, time: e.target.value }))}
                    />
                  </Field>
                  <Field label="Latitude" hint="Optional — needed to draw the route map">
                    <Input
                      type="number"
                      step="any"
                      value={stopForm.latitude}
                      onChange={(e) => setStopForm((f) => ({ ...f, latitude: e.target.value }))}
                      placeholder="12.9716"
                    />
                  </Field>
                  <Field label="Longitude" hint="Optional — needed to draw the route map">
                    <Input
                      type="number"
                      step="any"
                      value={stopForm.longitude}
                      onChange={(e) => setStopForm((f) => ({ ...f, longitude: e.target.value }))}
                      placeholder="77.5946"
                    />
                  </Field>
                  <div className="flex justify-end gap-2 sm:col-span-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddStop(false);
                        setStopForm({ name: "", time: "", latitude: "", longitude: "" });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveStopMutation.isPending}>
                      {saveStopMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Stop
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-1">
                {sortedStops.map((s, i) => (
                  <div key={s.id} className="rounded-lg border border-slate-100 px-3 py-2">
                    {editingStopId === s.id && canEdit ? (
                      <form
                        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveStopMutation.mutate({
                            stop: s,
                            routeId: route.id,
                            data: {
                              name: editForm.name.trim(),
                              time: editForm.time || undefined,
                              position: Math.max(0, parseInt(editForm.position) || 0),
                              latitude: toNullableNumber(editForm.latitude),
                              longitude: toNullableNumber(editForm.longitude),
                            },
                          });
                        }}
                      >
                        <div className="sm:col-span-2">
                          <Field label="Stop Name *">
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              required
                            />
                          </Field>
                        </div>
                        <Field label="Time">
                          <Input
                            type="time"
                            value={editForm.time}
                            onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))}
                          />
                        </Field>
                        <Field label="Position (order)">
                          <Input
                            type="number"
                            min={0}
                            value={editForm.position}
                            onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
                          />
                        </Field>
                        <Field label="Latitude">
                          <Input
                            type="number"
                            step="any"
                            value={editForm.latitude}
                            onChange={(e) => setEditForm((f) => ({ ...f, latitude: e.target.value }))}
                          />
                        </Field>
                        <Field label="Longitude">
                          <Input
                            type="number"
                            step="any"
                            value={editForm.longitude}
                            onChange={(e) => setEditForm((f) => ({ ...f, longitude: e.target.value }))}
                          />
                        </Field>
                        <div className="flex justify-end gap-2 sm:col-span-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setEditingStopId(null)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" size="sm" disabled={saveStopMutation.isPending}>
                            {saveStopMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{i + 1}</span>
                          <span className="text-sm text-slate-800">{s.name}</span>
                          {i === sortedStops.length - 1 && <Badge variant="success">School</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-500">{formatTime(s.time)}</span>
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(s)}>
                                <Pencil className="h-3.5 w-3.5 text-slate-500" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-600 hover:bg-red-50"
                                disabled={deleteStopMutation.isPending}
                                onClick={() => {
                                  if (window.confirm(`Remove stop "${s.name}"? Students assigned to this stop will keep a route but no pickup stop.`)) {
                                    deleteStopMutation.mutate(s.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {sortedStops.length === 0 && (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-xs text-slate-400">
                    No stops yet{canEdit ? " — add the first stop to get started" : ""}.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

/* ================= Modals ================= */

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

interface SchoolOption {
  id: string;
  name: string;
  schoolCode: string;
}

function VehicleModal({
  vehicle,
  vehicles,
  isSuperAdmin,
  schools,
  selectedSchoolId,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  vehicle?: VehicleInfo;
  vehicles: VehicleInfo[];
  isSuperAdmin?: boolean;
  schools?: SchoolOption[];
  selectedSchoolId?: string;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [form, setForm] = useState({
    registrationNo: vehicle?.registrationNo || "",
    type: vehicle?.type || "Bus",
    capacity: vehicle?.capacity ? String(vehicle.capacity) : "40",
    status: vehicle?.status || "ACTIVE",
    schoolId: vehicle?.schoolId || selectedSchoolId || "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const trimmedReg = form.registrationNo.trim().toUpperCase();
  const duplicateVehicle = vehicles.find(
    (v) =>
      v.id !== vehicle?.id &&
      v.registrationNo.toUpperCase() === trimmedReg &&
      (!isSuperAdmin || !form.schoolId || v.schoolId === form.schoolId)
  );

  return (
    <ModalShell
      title={vehicle ? "Edit Vehicle" : "Add Vehicle"}
      subtitle={vehicle ? "Update vehicle details" : "Register a new vehicle in the fleet"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (duplicateVehicle) return;
          onSubmit({
            registrationNo: form.registrationNo.trim().toUpperCase(),
            type: form.type.trim(),
            capacity: Math.max(1, parseInt(form.capacity) || 1),
            status: form.status,
            ...(isSuperAdmin ? { schoolId: form.schoolId } : {}),
          });
        }}
        className="grid gap-4 p-6"
      >
        {isSuperAdmin && (
          <Field label="School *" hint="The vehicle will be registered under this school">
            <Select value={form.schoolId} onChange={(e) => set("schoolId", e.target.value)} required>
              <option value="" disabled>Select a school</option>
              {(schools || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.schoolCode})</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Registration Number *" hint="Numbers are checked against this school's fleet for duplicates">
              <Input value={form.registrationNo} onChange={(e) => set("registrationNo", e.target.value)} required placeholder="e.g. KA-01-1234" />
              {duplicateVehicle && (
                <p className="text-xs font-medium text-red-600">
                  A vehicle with this registration number is already in this school's fleet.
                </p>
              )}
            </Field>
          </div>
          <Field label="Vehicle Type">
            <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option value="Bus">Bus</option>
              <option value="Mini Bus">Mini Bus</option>
              <option value="Van">Van</option>
            </Select>
          </Field>
          <Field label="Capacity (seats)">
            <Input type="number" min={1} max={500} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Status">
              <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </Field>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isLoading || !!duplicateVehicle}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {vehicle ? "Save Changes" : "Add Vehicle"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function DriverModal({
  driver,
  vehicles,
  isSuperAdmin,
  schools,
  selectedSchoolId,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  driver?: TransportDriver;
  vehicles: VehicleInfo[];
  isSuperAdmin?: boolean;
  schools?: SchoolOption[];
  selectedSchoolId?: string;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [form, setForm] = useState({
    name: driver?.name || "",
    phone: driver?.phone || "",
    licenseNo: driver?.licenseNo || "",
    vehicleId: driver?.vehicleId || "",
    schoolId: driver?.schoolId || selectedSchoolId || "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const schoolVehicles = vehicles.filter(
    (v) => !isSuperAdmin || !form.schoolId || v.schoolId === form.schoolId
  );

  return (
    <ModalShell title={driver ? "Edit Driver" : "Add Driver"} subtitle="Driver details and vehicle assignment" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name: form.name.trim(),
            phone: form.phone.trim(),
            licenseNo: form.licenseNo.trim() || undefined,
            vehicleId: form.vehicleId || null,
            ...(isSuperAdmin ? { schoolId: form.schoolId } : {}),
          });
        }}
        className="grid gap-4 p-6"
      >
        {isSuperAdmin && (
          <Field label="School *" hint="The driver will be registered under this school">
            <Select value={form.schoolId} onChange={(e) => set("schoolId", e.target.value)} required>
              <option value="" disabled>Select a school</option>
              {(schools || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.schoolCode})</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Full Name *">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="e.g. Ramesh Kumar" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone *">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} required placeholder="+91 98765 01234" />
          </Field>
          <Field label="License Number">
            <Input value={form.licenseNo} onChange={(e) => set("licenseNo", e.target.value)} placeholder="DL-48291" />
          </Field>
        </div>
        <Field label="Assigned Vehicle" hint={driver?.vehicle ? `Currently: ${driver.vehicle.registrationNo}` : undefined}>
          <Select value={form.vehicleId} onChange={(e) => set("vehicleId", e.target.value)}>
            <option value="">No vehicle</option>
            {schoolVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registrationNo} ({v.type || "Bus"})
              </option>
            ))}
          </Select>
        </Field>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {driver ? "Save Changes" : "Add Driver"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function RouteModal({
  route,
  isSuperAdmin,
  schools,
  selectedSchoolId,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  route?: TransportRoute;
  isSuperAdmin?: boolean;
  schools?: SchoolOption[];
  selectedSchoolId?: string;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [name, setName] = useState(route?.name || "");
  const [schoolId, setSchoolId] = useState(route?.schoolId || selectedSchoolId || "");
  const [vehicleNumber, setVehicleNumber] = useState(route?.vehicle.registrationNo || "");
  const [startTime, setStartTime] = useState(route?.startTime || "");
  const [endTime, setEndTime] = useState(route?.endTime || "");

  return (
    <ModalShell title={route ? "Edit Route" : "Add Route"} subtitle="Basic route info (stops can be added later)" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name: name.trim(),
            vehicleNumber: vehicleNumber.trim(),
            startTime: startTime || undefined,
            endTime: endTime || undefined,
            ...(isSuperAdmin ? { schoolId } : {}),
          });
        }}
        className="grid gap-4 p-6"
      >
        {isSuperAdmin && (
          <Field label="School *" hint="The route will be registered under this school">
            <Select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} required>
              <option value="" disabled>Select a school</option>
              {(schools || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.schoolCode})</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Route Name *">
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Route 1 - City Center" />
        </Field>
        <Field label="Vehicle Number *" hint="Bus registration number (e.g. KA-01-1234). If it doesn't exist yet, it will be created under the selected school.">
          <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} required placeholder="e.g. KA-01-1234" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start Time">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="End Time">
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {route ? "Save Changes" : "Create Route"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function AssignmentModal({
  students,
  studentsLoading,
  routes,
  vehicles,
  schoolId,
  isLoading,
  error,
  onClose,
  onSubmit,
}: {
  students: StudentOption[];
  studentsLoading: boolean;
  routes: TransportRoute[];
  vehicles: VehicleInfo[];
  schoolId?: string;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [stopId, setStopId] = useState("");

  const selectedRoute = routes.find((r) => r.id === routeId);
  const sortedStops = useMemo(
    () => (selectedRoute ? [...selectedRoute.stops].sort((a, b) => a.position - b.position) : []),
    [selectedRoute]
  );

  const effectiveVehicleId = selectedRoute?.vehicleId || vehicles[0]?.id || "";

  return (
    <ModalShell title="Assign Student to Bus" subtitle="Link a student to a route, bus, and pickup stop" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            studentId,
            routeId,
            vehicleId: effectiveVehicleId,
            stopId: stopId || undefined,
            ...(schoolId ? { schoolId } : {}),
          });
        }}
        className="grid gap-4 p-6"
      >
        <Field label="Student *">
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} required disabled={studentsLoading}>
            <option value="" disabled>{studentsLoading ? "Loading students..." : "Select a student"}</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
            ))}
          </Select>
        </Field>

        <Field label="Route *">
          <Select value={routeId} onChange={(e) => { setRouteId(e.target.value); setStopId(""); }} required>
            <option value="" disabled>Select a route</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.vehicle.registrationNo} · {r.vehicle.capacity ?? "?"} seats
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <Bus className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>
            Bus: <strong>{selectedRoute?.vehicle.registrationNo || "—"}</strong> (
            {selectedRoute ? `${selectedRoute.vehicle.capacity ?? "?"} seats` : "select a route first"})
            {selectedRoute ? ` · Driver: ${selectedRoute.vehicle.driver?.name || "not assigned"}` : ""}
          </span>
        </div>

        <Field label="Pickup Stop" hint="Leaving empty assigns the first stop by default">
          <Select value={stopId} onChange={(e) => setStopId(e.target.value)} disabled={!selectedRoute}>
            <option value="">Auto (first stop)</option>
            {sortedStops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.time ? `· ${formatTime(s.time)}` : ""}
              </option>
            ))}
          </Select>
        </Field>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isLoading || !studentId || !routeId}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign Student
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}