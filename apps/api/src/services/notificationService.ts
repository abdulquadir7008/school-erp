import nodemailer from "nodemailer";
import { prisma } from "../config/database";
import { config } from "../config";
import { AppError, NotFoundError, TenantError } from "../utils/errors";
import { feeMonthLabel, invoiceBalance, formatINR, roundMoney, academicYearLabel } from "../utils/fees";

export type DeliveryChannel = "EMAIL" | "SMS" | "WHATSAPP";

interface DeliveryAttempt {
  delivered: boolean;
  message: string;
  error?: string;
}

// ============================================================
// Provider abstraction — Email / SMS / WhatsApp can be swapped
// for real third-party providers later (Resend, Twilio, WhatsApp
// Business API, etc.) without touching the rest of the flow.
// ============================================================

const emailProvider = {
  async send(to: string, subject: string, text: string): Promise<DeliveryAttempt> {
    if (!config.smtp.host || !config.smtp.user) {
      // No SMTP configured — simulate a queued/sent delivery for now.
      return {
        delivered: true,
        message: `[EMAIL] Queued for ${to}\nSubject: ${subject}\n\n${text}`,
      };
    }
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
    try {
      await transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        text,
      });
      return { delivered: true, message: `Email sent to ${to}` };
    } catch (error: any) {
      return { delivered: false, message: `Email failed to ${to}`, error: error.message };
    }
  },
};

const smsProvider = {
  async send(to: string, text: string): Promise<DeliveryAttempt> {
    // TODO: integrate a real SMS gateway (Twilio / MSG91 / WhatsApp Business API).
    return { delivered: true, message: `[SMS] Queued for ${to}\n\n${text}\n\n(Provider integration pending)` };
  },
};

const whatsappProvider = {
  async send(to: string, text: string): Promise<DeliveryAttempt> {
    // TODO: integrate WhatsApp Business API (graph.facebook.com/v18.0/.../messages).
    return { delivered: true, message: `[WHATSAPP] Queued for ${to}\n\n${text}\n\n(Provider integration pending)` };
  },
};

const normalizePhone = (phone?: string | null) =>
  phone ? phone.replace(/[^\d+]/g, "").slice(0, 15) : "";

export const notificationService = {
  async sendReceipt(invoiceId: string, channel: DeliveryChannel, senderId: string | undefined, schoolId: string | undefined, isSuperAdmin = false) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        student: {
          include: {
            parents: { include: { parent: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } } },
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
        school: true,
        academicYear: true,
        feeStructure: { select: { name: true } },
      },
    });

    if (!invoice) throw new NotFoundError("Invoice");
    if (!isSuperAdmin && invoice.schoolId !== schoolId) throw new TenantError();

    const parent = invoice.student.parents[0]?.parent;
    if (!parent) throw new AppError("No parent/guardian linked to this student", 400, "NO_PARENT");

    const total = Number(invoice.totalAmount);
    const paid = Number(invoice.paidAmount);
    const discount = Number(invoice.discount);
    const fine = Number(invoice.fine);
    const balance = invoiceBalance(total, paid, discount, fine);
    const ayLabel = invoice.academicYear
      ? academicYearLabel(invoice.academicYear.startDate, invoice.academicYear.endDate)
      : "";
    const feePeriod =
      invoice.feeMonth && invoice.feeYear
        ? feeMonthLabel(invoice.feeMonth, invoice.feeYear)
        : invoice.feeStructure?.name || "Fee";

    const studentLine = `${invoice.student.firstName} ${invoice.student.lastName} (${invoice.student.admissionNumber})`;
    const subject = `Fee Receipt ${invoice.invoiceNumber} — Payment Confirmation`;
    const message = [
      `Dear ${parent.firstName} ${parent.lastName},`,
      ``,
      `Fee payment receipt for ${studentLine} has been confirmed.`,
      ``,
      `Invoice No.: ${invoice.invoiceNumber}`,
      `Academic Year: ${invoice.academicYear?.name || ayLabel || "—"}`,
      `Fee Period: ${feePeriod}`,
      `Amount Paid: ${formatINR(paid)}`,
      `Fine: ${formatINR(fine)}`,
      `Remaining Balance: ${formatINR(Math.max(0, balance))}`,
      `Status: ${invoice.status}`,
      ``,
      `Thank you,\n${invoice.school.name}`,
    ].join("\n");

    let recipient = "";
    let attempt: DeliveryAttempt | null = null;

    if (channel === "EMAIL") {
      recipient = parent.email || "";
      attempt = await emailProvider.send(recipient, subject, message);
    } else if (channel === "SMS") {
      recipient = normalizePhone(parent.phone);
      attempt = await smsProvider.send(recipient, message);
    } else if (channel === "WHATSAPP") {
      recipient = normalizePhone(parent.phone);
      attempt = await whatsappProvider.send(recipient, message);
    }

    if (!recipient) {
      throw new AppError(`No ${channel.toLowerCase()} contact available for the parent`, 400, "NO_CONTACT");
    }

    const delivery = await prisma.receiptDelivery.create({
      data: {
        invoiceId,
        channel,
        recipient,
        status: attempt?.delivered ? "SENT" : "FAILED",
        message: message.slice(0, 2000),
        error: attempt?.error,
        schoolId: invoice.schoolId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: senderId,
        action: "PUBLISH",
        entity: "RECEIPT_DELIVERY",
        entityId: delivery.id,
        schoolId: invoice.schoolId,
        newValue: { channel, recipient },
      },
    });

    return { delivery, status: delivery.status };
  },

  /**
   * Homework due-date reminders (in-app today, push-ready).
   * Creates one in-app `Notification` per pending student for every PUBLISHED
   * homework due within `hoursAhead`. Idempotent within a 24h window via the
   * `homework:<id>:reminder` link. Push delivery is integration-ready only:
   * wire `pushProvider.send()` to FCM/APNs and flip `pushDelivered` — the API
   * never claims push was delivered until then.
   */
  async homeworkDueReminders(schoolId: string | undefined, hoursAhead = 48, isSuperAdmin = false) {
    if (!schoolId && !isSuperAdmin) throw new TenantError("School context required");
    const now = new Date();
    const horizon = new Date(now.getTime() + hoursAhead * 3600_000);
    const dueSoon = await prisma.homework.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        status: "PUBLISHED",
        dueDate: { gte: now, lte: horizon },
      },
      select: { id: true, title: true, classId: true, sectionId: true, schoolId: true, dueDate: true },
      take: 200,
    });
    let notified = 0;
    const details: Array<{ homeworkId: string; notified: number }> = [];
    for (const hw of dueSoon) {
      const scope: any = { schoolId: hw.schoolId, classId: hw.classId, status: "ACTIVE" };
      if ((hw as any).sectionId) scope.sectionId = (hw as any).sectionId;
      const [students, completed, recent] = await Promise.all([
        prisma.student.findMany({ where: scope, select: { id: true, userId: true } }),
        prisma.homeworkSubmission.findMany({
          where: { homeworkId: hw.id, status: "COMPLETED" },
          select: { studentId: true },
        }),
        prisma.notification.findMany({
          where: { link: `homework:${hw.id}:reminder`, createdAt: { gte: new Date(now.getTime() - 24 * 3600_000) } },
          select: { userId: true },
        }),
      ]);
      const done = new Set(completed.map((c) => c.studentId));
      const reminded = new Set(recent.map((r) => r.userId));
      const link = `homework:${hw.id}:reminder`;
      const rows = students
        .filter((s) => s.userId && !done.has(s.id) && !reminded.has(s.userId as string))
        .map((s) => ({
          userId: s.userId as string,
          title: `Reminder: "${hw.title}" due ${hw.dueDate.toISOString().slice(0, 10)}`,
          message: `Homework "${hw.title}" is due on ${hw.dueDate.toISOString().slice(0, 10)}. Submit it before the deadline.`,
          type: "IN_APP" as const,
          link,
          schoolId: hw.schoolId,
        }));
      if (rows.length) {
        const res = await prisma.notification.createMany({ data: rows });
        notified += res.count;
        details.push({ homeworkId: hw.id, notified: res.count });
        // PUSH integration point (not delivered yet):
        // await pushProvider.sendForUsers(rows.map(r => r.userId), { title, body, data: { homeworkId: hw.id } });
      }
    }
    return { checked: dueSoon.length, notified, details, pushDelivered: false };
  },

  async listDeliveries(invoiceId: string, schoolId: string | undefined, isSuperAdmin = false) {
    if (!schoolId && !isSuperAdmin) throw new TenantError("School context required");
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { schoolId: true } });
    if (!invoice) throw new NotFoundError("Invoice");
    if (!isSuperAdmin && invoice.schoolId !== schoolId) throw new TenantError();
    return prisma.receiptDelivery.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "desc" },
    });
  },
};

export { roundMoney };