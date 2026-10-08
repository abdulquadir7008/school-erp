import PDFDocument from "pdfkit";
import { prisma } from "../config/database";
import {
  academicYearLabel,
  feeMonthLabel,
  formatINRPlain,
  invoiceBalance,
  roundMoney,
} from "../utils/fees";

type PDFDoc = InstanceType<typeof PDFDocument>;

const GREEN = "#166534";
const SLATE = "#0f172a";
const SLATE_MUTED = "#64748b";
const BORDER = "#cbd5e1";
const ROW_ALT = "#f8fafc";

const MONEY = (v: number | string) => formatINRPlain(v);
const DATE = (d?: Date | string | null) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");

export class PdfService {
  /** Promisified PDF generation into a Node Buffer. */
  private toBuffer(doc: PDFDoc): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  }

  private drawHeader(doc: PDFDoc, school: any) {
    const W = doc.page.width - 2 * 60;
    const y0 = 40;

    doc
      .fillColor(GREEN)
      .rect(0, 0, doc.page.width, 9)
      .fill();

    doc.fillColor("transparent").strokeColor("transparent");

    const logo = school?.logo;
    let useImage = false;
    let initial = (school?.name || "S").trim().charAt(0).toUpperCase();
    if (logo && /^([A-Za-z]:|\.\/|\/)/.test(logo)) {
      // local path only — remote S3 URLs are skipped for reliability
      try {
        doc.image(logo, 60, y0 + 2, { fit: [54, 54] });
        useImage = true;
      } catch {
        useImage = false;
      }
    }

    if (!useImage) {
      doc
        .roundedRect(60, y0, 56, 56, 8)
        .fillColor(GREEN)
        .fill();
      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(24)
        .text(initial, 60, y0 + 14, { width: 56, align: "center" });
    }

    doc
      .fillColor(SLATE)
      .font("Helvetica-Bold")
      .fontSize(17)
      .text(school?.name || "School", useImage ? 130 : 140, y0, { width: W - 80 });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(SLATE_MUTED)
      .text(
        [
          [school?.address, school?.city, school?.state].filter(Boolean).join(", "),
          `Phone: ${school?.phone || "—"}`,
          `Email: ${school?.email || "—"}${school?.website ? `  •  Web: ${school.website}` : ""}`,
        ].join("\n"),
        useImage ? 130 : 140,
        y0 + 24,
        { width: W - 80, lineGap: 2 }
      );

    doc
      .strokeColor(BORDER)
      .lineWidth(1)
      .moveTo(60, 118)
      .lineTo(doc.page.width - 60, 118)
      .stroke();

    return 130;
  }

  private drawFooter(doc: PDFDoc, schoolName: string) {
    const height = doc.page.height - 60;
    doc
      .strokeColor(BORDER)
      .lineWidth(1)
      .moveTo(60, height)
      .lineTo(doc.page.width - 60, height)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(SLATE_MUTED)
      .text(
        `This is a computer generated fee receipt from ${schoolName || "School"}. Please retain for your records.`,
        60,
        height + 8,
        { width: doc.page.width - 120, align: "center" }
      );
  }

  private drawTable(
    doc: PDFDoc,
    opts: {
      headers: string[];
      widths: number[];
      rows: (string | number)[][];
      startY: number;
      rowHeight?: number;
      headerBg?: string;
      align?: ("left" | "center" | "right")[];
      moneyCols?: number[];
    }
  ) {
    const rowHeight = opts.rowHeight || 24;
    const startX = 60;
    const headerBg = opts.headerBg || GREEN;
    const totalWidth = opts.widths.reduce((a, b) => a + b, 0);

    let y = opts.startY;

    doc.rect(startX, y, totalWidth, rowHeight).fill(headerBg);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
    let x = startX;
    opts.headers.forEach((h, i) => {
      const align = opts.align?.[i] || "left";
      const px = align === "right" ? x + opts.widths[i] : align === "center" ? x + opts.widths[i] / 2 : x;
      doc.text(h, align === "right" ? px : align === "center" ? px : px + 6, y + 8, {
        width: opts.widths[i] - (align === "right" ? 6 : 12),
        align: align === "right" ? "right" : "left",
        lineBreak: false,
      });
      if (align === "center") {
        doc.text(h, x + 6, y + 8, { width: opts.widths[i] - 12, align: "left", lineBreak: false });
      }
      x += opts.widths[i];
    });
    y += rowHeight;

    for (let r = 0; r < opts.rows.length; r++) {
      const row = opts.rows[r];
      if (r % 2 === 1) {
        doc.rect(startX, y, totalWidth, rowHeight).fill(ROW_ALT);
      }
      doc
        .strokeColor(BORDER)
        .lineWidth(0.5)
        .moveTo(startX, y + rowHeight)
        .lineTo(startX + totalWidth, y + rowHeight)
        .stroke();
      doc.fillColor(SLATE).font("Helvetica").fontSize(8.5);
      x = startX;
      row.forEach((cell, i) => {
        const isMoney = opts.moneyCols?.includes(i);
        const align = opts.align?.[i] || "left";
        doc
          .font(isMoney ? "Helvetica" : "Helvetica")
          .fontSize(8.5)
          .fillColor(SLATE);
        doc.text(String(cell), x + 6, y + 7, {
          width: opts.widths[i] - 12,
          align: align === "right" ? "right" : "left",
          lineBreak: false,
          ellipsis: true,
        });
        x += opts.widths[i];
      });
      y += rowHeight;
    }

    doc.strokeColor(BORDER).lineWidth(1).moveTo(startX, y).lineTo(startX + totalWidth, y).stroke();
    return y;
  }

  async generateInvoicePdf(
    invoiceId: string,
    schoolId: string | undefined,
    isSuperAdmin = false
  ): Promise<Buffer> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            studentId: true,
            rollNumber: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
            parents: { include: { parent: { select: { firstName: true, lastName: true, phone: true, email: true } } } },
          },
        },
        school: true,
        feeStructure: { select: { name: true, feeType: true } },
        academicYear: true,
        items: true,
        payments: {
          orderBy: { paidAt: "desc" },
          select: { id: true, amount: true, method: true, transactionId: true, paidAt: true, receivedBy: true, status: true },
        },
        fineHistories: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!invoice) throw new Error("Invoice not found");
    if (!isSuperAdmin && invoice.schoolId !== schoolId) {
      throw new Error("Access denied");
    }

    let previousPending = 0;
    if (invoice.studentId) {
      const others = await prisma.invoice.findMany({
        where: {
          studentId: invoice.studentId,
          id: { not: invoice.id },
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        },
        select: { totalAmount: true, paidAmount: true, discount: true, fine: true },
      });
      previousPending = others.reduce(
        (s, o) => s + invoiceBalance(Number(o.totalAmount), Number(o.paidAmount), Number(o.discount), Number(o.fine)),
        0
      );
    }

    const school = invoice.school;
    const student = invoice.student;
    const parent = student.parents[0]?.parent;
    const total = Number(invoice.totalAmount);
    const paid = Number(invoice.paidAmount);
    const discount = Number(invoice.discount);
    const fine = Number(invoice.fine);
    const final = roundMoney(total + fine - discount);
    const ayLabel = invoice.academicYear
      ? academicYearLabel(invoice.academicYear.startDate, invoice.academicYear.endDate)
      : "";
    const feePeriod =
      invoice.feeMonth && invoice.feeYear
        ? feeMonthLabel(invoice.feeMonth, invoice.feeYear)
        : invoice.feeStructure?.name || "—";

    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const buffers: Buffer[] = [];
    doc.on("data", (c: Buffer) => buffers.push(c));

    this.drawHeader(doc, school);
    doc.y = 132;

    // Title row
    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor(GREEN)
      .text("FEE PAYMENT RECEIPT / INVOICE", 60, doc.y, { width: 330 });

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(SLATE)
      .text(invoice.invoiceNumber, 360, doc.y, { width: 175, align: "right" });

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(SLATE_MUTED)
      .text(
        `Academic Year: ${invoice.academicYear?.name || ayLabel || "—"}\nFee Period: ${feePeriod}\nInvoice Date: ${DATE(invoice.createdAt)}    Due Date: ${DATE(invoice.dueDate)}`,
        60,
        doc.y + 2,
        { width: 330, lineGap: 2 }
      );

    // Status chip
    const status = invoice.status;
    doc.roundedRect(360, 158, 175, 24, 4);
    if (status === "PAID") doc.fillColor("#16a34a");
    else if (status === "PARTIAL") doc.fillColor("#d97706");
    else if (status === "OVERDUE") doc.fillColor("#dc2626");
    else doc.fillColor("#64748b");
    doc.fill();
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(status, 360, 164, { width: 175, align: "center" });

    // Billing / student details
    let y = 208;
    doc.strokeColor(BORDER).lineWidth(0.75).rect(60, y, 330, 74).stroke();
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(8).text("STUDENT DETAILS", 66, y + 6);
    doc.fillColor(SLATE).font("Helvetica").fontSize(9);
    doc.text(
      `${student.firstName} ${student.lastName}`,
      66,
      y + 20,
      { width: 310, lineBreak: false }
    );
    doc.font("Helvetica").fontSize(8.5).fillColor(SLATE_MUTED);
    doc.text(
      `Student ID: ${student.studentId || "—"}   •   Admission No.: ${student.admissionNumber}\nClass: ${student.class?.name || "—"}   •   Section: ${student.section?.name || "—"}   •   Roll: ${student.rollNumber ?? "—"}`,
      66,
      y + 34,
      { width: 310, lineGap: 3 }
    );

    doc.strokeColor(BORDER).lineWidth(0.75).rect(405, y, 130, 74).stroke();
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(8).text("BILLED TO", 411, y + 6);
    doc.fillColor(SLATE).font("Helvetica").fontSize(9);
    const parentName = parent ? `${parent.firstName} ${parent.lastName}` : "—";
    doc.text(parentName, 411, y + 20, { width: 115, lineBreak: false });
    doc.fillColor(SLATE_MUTED).font("Helvetica").fontSize(8.5);
    doc.text(
      `${parent?.phone || ""}\n${parent?.email || ""}`,
      411,
      y + 34,
      { width: 115, lineGap: 3 }
    );

    y += 92;

    // Fee items table
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(8.5).text("FEE DETAILS", 60, y);
    y += 12;

    const rows = invoice.items.map((item) => [
      item.description || "Fee",
      MONEY(Number(item.amount)),
      MONEY(discount),
      MONEY(fine),
      MONEY(roundMoney(Number(item.amount) - discount + fine)),
    ]);

    y = this.drawTable(doc, {
      headers: ["Description", "Fee Amount", "Discount", "Fine", "Final Amount"],
      widths: [210, 70, 70, 70, 115],
      rows,
      startY: y,
      align: ["left", "right", "right", "right", "right"],
      moneyCols: [1, 2, 3, 4],
    });

    y += 14;

    // Totals
    const finalTotal = roundMoney(final + previousPending);
    const remainingTotal = roundMoney(Math.max(0, finalTotal - paid));
    const totalsRows: [string, string][] = [
      ["Subtotal", MONEY(total)],
      ["Discount", `− ${MONEY(discount)}`],
      ["Fine", MONEY(fine)],
      ["Previous Pending Balance", MONEY(previousPending)],
      ["Total Payable", MONEY(finalTotal)],
      ["Amount Paid", MONEY(paid)],
      ["Remaining Balance", MONEY(remainingTotal)],
    ];

    doc.font("Helvetica-Bold").fontSize(9).fillColor(GREEN).text("PAYMENT SUMMARY", 60, y);
    y += 12;

    doc.font("Helvetica").fontSize(9);
    let tx = 60;
    for (const [label, value] of totalsRows) {
      if (y > doc.page.height - 150) {
        this.drawFooter(doc, school.name);
        doc.addPage();
        doc.y = 60;
        y = 60;
      }
      tx = 60;
      doc.fillColor(SLATE_MUTED).font("Helvetica").text(label, tx, y, { width: 180 });
      doc.fillColor(SLATE).font("Helvetica-Bold").text(value, 60 + 180, y, { width: 295, align: "right" });
      y += 18;
    }
    doc
      .strokeColor(GREEN)
      .lineWidth(1.5)
      .moveTo(60, y)
      .lineTo(535, y)
      .strokeColor(BORDER)
      .lineWidth(0.75);
    y += 10;

    // Payment details
    doc.font("Helvetica-Bold").fontSize(9).fillColor(GREEN).text("PAYMENT DETAILS", 60, y);
    y += 12;
    const lastPayment = invoice.payments[0];
    doc.font("Helvetica").fontSize(8.5).fillColor(SLATE);
    doc.text(
      [
        `Invoice No.: ${invoice.invoiceNumber}`,
        `Invoice Date: ${DATE(invoice.createdAt)}`,
        `Due Date: ${DATE(invoice.dueDate)}`,
      ].join("\n"),
      60,
      y,
      { width: 200, lineGap: 3 }
    );
    doc.text(
      [
        lastPayment
          ? `Payment Method: ${String(lastPayment.method).replace(/_/g, " ")}`
          : "Payment Method: —",
        lastPayment?.transactionId ? `Payment Reference: ${lastPayment.transactionId}` : "Payment Reference: —",
        lastPayment ? `Payment Date: ${DATE(lastPayment.paidAt)}` : "Payment Date: —",
      ].join("\n"),
      300,
      y,
      { width: 235, lineGap: 3 }
    );

    // Fine history
    if (invoice.fineHistories.length > 0) {
      y += 60;
      doc.font("Helvetica-Bold").fontSize(9).fillColor(GREEN).text("FINE ADJUSTMENT HISTORY", 60, y);
      y += 12;
      const fRows = invoice.fineHistories.map((h) => [
        DATE(h.createdAt),
        MONEY(Number(h.previousFine)),
        MONEY(Number(h.newFine)),
        h.reason ? `(n.a.) ${h.reason}` : "Recorded by admin",
      ]);
      y = this.drawTable(doc, {
        headers: ["Date", "Previous Fine", "New Fine", "Reason"],
        widths: [90, 90, 90, 265],
        rows: fRows,
        startY: y,
        align: ["left", "right", "right", "left"],
        moneyCols: [1, 2],
      });
    }

    // Signature area
    let sigY = doc.page.height - 130;
    if (y > sigY - 40) {
      doc.addPage();
      sigY = doc.page.height - 130;
    }
    doc
      .strokeColor(BORDER)
      .lineWidth(0.75)
      .moveTo(60, sigY - 8)
      .lineTo(205, sigY - 8)
      .moveTo(390, sigY - 8)
      .lineTo(535, sigY - 8)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(SLATE_MUTED)
      .text("Received By / Accountant", 60, sigY, { width: 160 })
      .text("Authorized Signatory", 390, sigY, { width: 160 });

    const footerNote = `Thank you for your payment. This receipt was generated on ${DATE(new Date())}.`;
    doc.font("Helvetica").fontSize(8).fillColor(GREEN).text(footerNote, 60, sigY + 20, { width: 475, align: "center" });

    this.drawFooter(doc, school.name);

    doc.end();
    return this.toBuffer(doc);
  }

  async generatePendingReportPdf(payload: {
    school: { name: string; email?: string; phone?: string; address?: string; website?: string };
    academicYear?: { name: string; label: string } | null;
    filters: Record<string, string | number | null | undefined>;
    rows: any[];
    summary: any;
    classSummary: any[];
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });

    this.drawHeader(doc, payload.school);
    doc.y = 132;

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(GREEN)
      .text("PENDING FEE REPORT", 60, doc.y);

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(SLATE_MUTED)
      .text(
        [
          `Academic Year: ${payload.academicYear?.name || "All years"}`,
          `Generated On: ${DATE(new Date())}`,
          payload.filters.className ? `Class: ${payload.filters.className}` : "",
          payload.filters.sectionName ? `Section: ${payload.filters.sectionName}` : "",
          payload.filters.status ? `Status: ${payload.filters.status}` : "",
        ]
          .filter(Boolean)
          .join("    •    "),
        60,
        doc.y,
        { width: 475, lineGap: 3 }
      );

    let y = doc.y + 18;

    const headers = ["Student", "Admission No.", "Class / Sec", "Fee Month", "Total", "Paid", "Fine", "Disc.", "Pending", "Due", "Status"];
    const widths = [110, 58, 60, 62, 46, 44, 40, 38, 48, 52, 42];
    const align: ("left" | "right")[] = ["left", "left", "left", "left", "right", "right", "right", "right", "right", "left", "left"];

    // Group by class-section for readability
    const groups = new Map<string, any[]>();
    for (const row of payload.rows) {
      const key = `${row.className}${row.sectionName ? "-" + row.sectionName : ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    for (const [groupKey, groupRows] of groups) {
      if (y > doc.page.height - 110) {
        this.drawFooter(doc, payload.school.name);
        doc.addPage();
        doc.y = 60;
        y = 60;
      }
      doc
        .fillColor(GREEN)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(groupKey, 60, y);
      y += 14;

      const tableRows = groupRows.map((r) => [
        `${r.studentName}\n${r.admissionNumber}`,
        r.admissionNumber,
        `${r.className}${r.sectionName ? "/" + r.sectionName : ""}`,
        r.feeMonthLabel || "—",
        MONEY(r.totalFee),
        MONEY(r.paidAmount),
        MONEY(r.fine),
        MONEY(r.discount),
        MONEY(r.pending),
        DATE(r.dueDate),
        r.status,
      ]);

      // Compact row cells: use 8pt and wrap
      y = this.drawTable(doc, {
        headers,
        widths,
        rows: tableRows,
        startY: y,
        rowHeight: 26,
        align: align as any,
        moneyCols: [4, 5, 6, 7, 8],
      });
      y += 8;
    }

    if (y > doc.page.height - 160) {
      this.drawFooter(doc, payload.school.name);
      doc.addPage();
      doc.y = 60;
      y = 60;
    }

    // Summary
    doc.font("Helvetica-Bold").fontSize(10).fillColor(GREEN).text("SUMMARY", 60, y);
    y += 12;

    const sRows: [string, string][] = [
      ["Total Students (outstanding)", String(payload.summary.totalStudents)],
      ["Total Records", String(payload.summary.totalRecords)],
      ["Total Fee", MONEY(payload.summary.totalFee)],
      ["Total Fine", MONEY(payload.summary.totalFine)],
      ["Total Discount", MONEY(payload.summary.totalDiscount)],
      ["Total Paid", MONEY(payload.summary.totalPaid)],
      ["Total Pending", MONEY(payload.summary.totalPending)],
    ];

    doc.font("Helvetica").fontSize(9);
    for (const [label, value] of sRows) {
      doc.fillColor(SLATE_MUTED).text(label, 60, y, { width: 220 });
      doc.fillColor(SLATE).font("Helvetica-Bold").text(value, 290, y, { width: 245, align: "right" });
      doc.font("Helvetica").fontSize(9);
      y += 17;
    }
    doc
      .strokeColor(GREEN)
      .lineWidth(1.5)
      .moveTo(60, y)
      .lineTo(535, y)
      .stroke();

    this.drawFooter(doc, payload.school.name);
    doc.end();
    return this.toBuffer(doc);
  }
}

export const pdfService = new PdfService();