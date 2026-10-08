"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/** Heavy recharts sections, split out so the dashboard page chunk stays
 *  light and each chart is lazy-loaded via `next/dynamic` (ssr: false).
 *  These components only mount when their dynamic wrapper resolves. */

export function RevenueChart({
  data,
}: {
  data: { month: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a7a1a" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#1a7a1a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis
          tick={{ fontSize: 12 }}
          stroke="#94a3b8"
          tickFormatter={(v) => `₹${v / 1000}k`}
        />
        <Tooltip
          formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Revenue"]}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#1a7a1a"
          strokeWidth={2}
          fill="url(#revenueGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AttendanceChart({
  data,
}: {
  data: { month: string; rate: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis domain={[80, 100]} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${value}%`, "Attendance"]} />
        <Bar dataKey="rate" fill="#5598ff" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FeeMixChart({
  data,
  colors,
}: {
  data: { name: string; value: number }[];
  colors: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ name, percent }) =>
            `${name} ${Math.round((percent || 0) * 100)}%`
          }
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function GrowthChart({
  data,
}: {
  data: { month: string; students: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="studentGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5598ff" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#5598ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="students"
          stroke="#5598ff"
          strokeWidth={2}
          fill="url(#studentGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
