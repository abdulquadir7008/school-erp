import { api } from "@/lib/api";
import type { BadgeProps } from "@/components/ui/badge";

export type InvoiceStatus = "PAID" | "PARTIAL" | "PENDING" | "OVERDUE" | "CANCELLED" | "REFUNDED";

export const statusVariant: Record<InvoiceStatus, NonNullable<BadgeProps["variant"]>> = {
  PAID: "success",
  PARTIAL: "warning",
  PENDING: "secondary",
  OVERDUE: "danger",
  CANCELLED: "secondary",
  REFUNDED: "secondary",
};

export const fmt = (n: number | string) => `₹${Number(n).toLocaleString("en-IN")}`;

export const AY_MONTHS: [number, string][] = [
  [4, "Apr"],
  [5, "May"],
  [6, "Jun"],
  [7, "Jul"],
  [8, "Aug"],
  [9, "Sep"],
  [10, "Oct"],
  [11, "Nov"],
  [12, "Dec"],
  [1, "Jan"],
  [2, "Feb"],
  [3, "Mar"],
];

export async function downloadPdf(url: string, filename = "document.pdf") {
  const res = await api.get(url, { responseType: "blob" });
  const blob =
    res.data instanceof Blob ? res.data : new Blob([res.data as BlobPart], { type: "application/pdf" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}