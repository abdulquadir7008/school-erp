import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { feeService } from "../services/feeService";
import { pdfService } from "../services/pdfService";
import { notificationService } from "../services/notificationService";
import { TenantError } from "../utils/errors";
import { getParam } from "../utils/request";

const getContextSchoolId = (req: AuthRequest): string | undefined => {
  if (req.user?.isSuperAdmin) {
    return (req.body.schoolId || req.query.schoolId || req.params.schoolId) as
      | string
      | undefined;
  }
  return req.user?.schoolId || undefined;
};

const schoolIdOrThrow = (req: AuthRequest): string => {
  const schoolId = getContextSchoolId(req);
  if (!schoolId) throw new TenantError("School context required");
  return schoolId;
};

const queryString = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

const queryNumber = (value: unknown): number | undefined => {
  if (typeof value === "string" && value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

export const feeController = {
  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await feeService.getDashboardStats(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false,
        queryString(req.query.academicYearId)
      );
      res.json({
        success: true,
        data: stats,
        message: "Fee dashboard stats retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  // ------------------------------------------------------------
  // Academic years
  // ------------------------------------------------------------
  async listAcademicYears(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const years = await feeService.listAcademicYears(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: years, message: "Academic years retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createAcademicYear(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const year = await feeService.createAcademicYear({
        ...req.body,
        schoolId: schoolIdOrThrow(req),
      });
      res.status(201).json({
        success: true,
        data: year,
        message: "Academic year created",
      });
    } catch (error) {
      next(error);
    }
  },

  async updateAcademicYear(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const year = await feeService.updateAcademicYear(
        getParam(req.params.id),
        schoolIdOrThrow(req),
        req.body
      );
      res.json({ success: true, data: year, message: "Academic year updated" });
    } catch (error) {
      next(error);
    }
  },

  async setCurrentAcademicYear(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const year = await feeService.updateAcademicYear(
        getParam(req.params.id),
        schoolIdOrThrow(req),
        { isCurrent: true }
      );
      res.json({ success: true, data: year, message: "Current academic year updated" });
    } catch (error) {
      next(error);
    }
  },

  // ------------------------------------------------------------
  // Categories & structures
  // ------------------------------------------------------------
  async listCategories(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const categories = await feeService.listCategories(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: categories, message: "Fee categories retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async listStructures(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await feeService.listStructures(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false,
        {
          academicYearId: queryString(req.query.academicYearId),
          classId: queryString(req.query.classId),
          sectionId: queryString(req.query.sectionId),
          feeType: queryString(req.query.feeType),
        }
      );
      res.json({ success: true, data: result.data, categories: result.categories, message: "Fee structures retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createStructure(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const structure = await feeService.createStructure({
        ...req.body,
        schoolId: schoolIdOrThrow(req),
      });
      res.status(201).json({
        success: true,
        data: structure,
        message: "Fee structure created",
      });
    } catch (error) {
      next(error);
    }
  },

  async updateStructure(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const structure = await feeService.updateStructure(
        getParam(req.params.id),
        schoolIdOrThrow(req),
        req.body
      );
      res.json({ success: true, data: structure, message: "Fee structure updated" });
    } catch (error) {
      next(error);
    }
  },

  async deleteStructure(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await feeService.deleteStructure(
        getParam(req.params.id),
        schoolIdOrThrow(req)
      );
      res.json({ success: true, data: result, message: "Fee structure deleted" });
    } catch (error) {
      next(error);
    }
  },

  async generateInvoices(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await feeService.generateInvoices({
        ...req.body,
        schoolId: schoolIdOrThrow(req),
      });
      res.json({
        success: true,
        data: result,
        message: `${result.count} invoice(s) generated`,
      });
    } catch (error) {
      next(error);
    }
  },

  async createInvoice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await feeService.createInvoice({
        ...req.body,
        schoolId: schoolIdOrThrow(req),
      });
      res.status(201).json({
        success: true,
        data: invoice,
        message: "Invoice created",
      });
    } catch (error) {
      next(error);
    }
  },

  // ------------------------------------------------------------
  // Invoices
  // ------------------------------------------------------------
  async listInvoices(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await feeService.listInvoices({
        page: queryNumber(req.query.page) || 1,
        limit: queryNumber(req.query.limit) || 15,
        search: queryString(req.query.search),
        status: queryString(req.query.status),
        schoolId: getContextSchoolId(req),
        academicYearId: queryString(req.query.academicYearId),
        classId: queryString(req.query.classId),
        sectionId: queryString(req.query.sectionId),
        studentId: queryString(req.query.studentId),
        feeMonth: queryNumber(req.query.feeMonth),
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });
      res.json({
        success: true,
        data: result.data,
        message: "Invoices retrieved",
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  },

  async getInvoice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await feeService.getInvoiceById(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: invoice, message: "Invoice retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async getInvoicePdf(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const buffer = await pdfService.generateInvoicePdf(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      const invoice = await feeService.getInvoiceById(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="receipt-${invoice.invoiceNumber}.pdf"`
      );
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  },

  async applyFine(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await feeService.applyFine(
        getParam(req.params.id),
        schoolIdOrThrow(req),
        Number(req.body.fine),
        queryString(req.body.reason),
        req.user?.id || "system"
      );
      res.json({
        success: true,
        data: result,
        message: "Fine adjusted successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async sendReceipt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await notificationService.sendReceipt(
        getParam(req.params.id),
        req.body.channel,
        req.user?.id,
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.status(201).json({
        success: true,
        data: result,
        message: `Receipt ${result.status === "SENT" ? "sent" : "queued"} successfully`,
      });
    } catch (error) {
      next(error);
    }
  },

  // ------------------------------------------------------------
  // Payments
  // ------------------------------------------------------------
  async collectPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await feeService.collectPayment({
        ...req.body,
        receivedBy: req.user?.id,
        schoolId: schoolIdOrThrow(req),
      });
      res.status(201).json({
        success: true,
        data: result,
        message: "Payment collected successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async getStudentHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await feeService.getStudentHistory(
        getParam(req.params.studentId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: result, message: "Student payment history retrieved" });
    } catch (error) {
      next(error);
    }
  },

  // ------------------------------------------------------------
  // Reports
  // ------------------------------------------------------------
  async pendingReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await feeService.getPendingReport({
        schoolId: getContextSchoolId(req),
        academicYearId: queryString(req.query.academicYearId),
        classId: queryString(req.query.classId),
        sectionId: queryString(req.query.sectionId),
        studentId: queryString(req.query.studentId),
        feeMonth: queryNumber(req.query.feeMonth),
        feeType: queryString(req.query.feeType),
        status: queryString(req.query.status),
        search: queryString(req.query.search),
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });
      res.json({ success: true, data: result, message: "Pending fee report generated" });
    } catch (error) {
      next(error);
    }
  },

  async pendingReportPdf(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const result = await feeService.getPendingReport({
        schoolId,
        academicYearId: queryString(req.query.academicYearId),
        classId: queryString(req.query.classId),
        sectionId: queryString(req.query.sectionId),
        studentId: queryString(req.query.studentId),
        feeMonth: queryNumber(req.query.feeMonth),
        feeType: queryString(req.query.feeType),
        status: queryString(req.query.status),
        search: queryString(req.query.search),
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });

      const school = await feeService.getReportSchool(schoolId);
      const year = req.query.academicYearId
        ? await feeService.getReportYear( queryString(req.query.academicYearId))
        : null;

      const buffer = await pdfService.generatePendingReportPdf({
        school,
        academicYear: year,
        filters: {
          className: queryString(req.query.className),
          sectionName: queryString(req.query.sectionName),
          status: queryString(req.query.status),
          feeMonth: queryNumber(req.query.feeMonth),
        },
        rows: result.rows,
        summary: result.summary,
        classSummary: result.classSummary,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="pending-fee-report.pdf"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  },
};