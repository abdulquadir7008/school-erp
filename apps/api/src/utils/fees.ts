export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Short month labels used for payroll-like month headers. */
export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export type InvoiceStatus =
  | "PAID"
  | "PARTIAL"
  | "PENDING"
  | "OVERDUE"
  | "CANCELLED"
  | "REFUNDED";

export const roundMoney = (value: number): number =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const formatINR = (value: number | string): string => {
  const amount = roundMoney(Number(value) || 0);
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** PDF-safe money format (₹ glyphs are unreliable in standard PDF fonts). */
export const formatINRPlain = (value: number | string): string => {
  const amount = roundMoney(Number(value) || 0);
  return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Academic years always run April → March.
 * label "2026-27" is derived from the calendar years of startDate/endDate.
 */
export const academicYearLabel = (startDate: Date | string, endDate: Date | string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sy = start.getFullYear();
  const ey = end.getFullYear();
  if (Math.abs(ey - sy) <= 1) {
    return `${sy}-${String(ey).slice(2)}`;
  }
  return `${sy}-${ey}`;
};

/** Human-facing name for a fee period, e.g. "August 2026". */
export const feeMonthLabel = (feeMonth: number, feeYear: number): string =>
  `${MONTH_NAMES[(feeMonth - 1 + 12) % 12]} ${feeYear}`;

/**
 * Monthly fee due date rule from the business requirements:
 * August month's fee → due 1st–10th of September. Therefore a fee billed for
 * calendar `feeMonth` (1–12) of `feeYear` is due on the 10th of the next month.
 */
export const monthlyDueDate = (feeMonth: number, feeYear: number): Date =>
  new Date(feeYear, feeMonth, 10, 23, 59, 59);

/** All calendar months covered by a given academic year. */
export const academicYearMonths = (
  startDate: Date | string,
  endDate: Date | string
): { feeMonth: number; feeYear: number }[] => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months: { feeMonth: number; feeYear: number }[] = [];

  if (
    start.getMonth() + 1 !== 4 ||
    end.getMonth() + 1 !== 3 ||
    end.getDate() !== 31
  ) {
    // Not a strict April–March year; fall back to walking month by month.
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      months.push({ feeMonth: cursor.getMonth() + 1, feeYear: cursor.getFullYear() });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }

  for (let m = 4; m <= 12; m++) {
    months.push({ feeMonth: m, feeYear: start.getFullYear() });
  }
  for (let m = 1; m <= 3; m++) {
    months.push({ feeMonth: m, feeYear: end.getFullYear() });
  }
  return months;
};

export const resolveInvoiceStatus = (
  amount: number,
  paid: number,
  discount = 0,
  fine = 0,
  dueDate?: Date | null
): InvoiceStatus => {
  const payable = roundMoney(amount + fine - discount);
  const remaining = roundMoney(payable - paid);
  if (remaining <= 0) return "PAID";
  if (paid > 0) return "PARTIAL";
  if (dueDate && new Date(dueDate) < new Date()) return "OVERDUE";
  return "PENDING";
};

/** Net outstanding amount for an invoice (total + fine − discount − paid). */
export const invoiceBalance = (
  totalAmount: number,
  paidAmount: number,
  discount = 0,
  fine = 0
): number => roundMoney(Number(totalAmount) + Number(fine) - Number(discount) - Number(paidAmount));