import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { examService } from "../services/examService";
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

export const examController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");

      const exam = await examService.create({
        ...req.body,
        schoolId,
      });

      res.status(201).json({
        success: true,
        data: exam,
        message: "Exam created successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const exam = await examService.getById(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false,
        req.user
      );
      res.json({
        success: true,
        data: exam,
        message: "Exam retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const exam = await examService.update(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: exam,
        message: "Exam updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const exam = await examService.updateStatus(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.body.status,
        req.user?.isSuperAdmin || false,
        req.user
      );
      res.json({
        success: true,
        data: exam,
        message: `Exam ${req.body.status.toLowerCase()} status set`,
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await examService.delete(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: result,
        message: "Exam deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const str = (v: unknown) => (typeof v === "string" ? v : undefined);
      const result = await examService.list({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        search: str(req.query.search),
        status: str(req.query.status),
        academicYearId: str(req.query.academicYearId),
        classId: str(req.query.classId),
        sectionId: str(req.query.sectionId),
        type: str(req.query.type),
        schoolId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
        auth: req.user,
      });

      res.json({
        success: true,
        data: result.data,
        message: "Exams retrieved",
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  },

  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const stats = await examService.getDashboardStats(
        schoolId,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: stats,
        message: "Exam dashboard stats retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async getResults(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await examService.getResults(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false,
        req.user
      );
      res.json({
        success: true,
        data: result,
        message: "Exam results retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async enterMarks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await examService.enterMarks(
        getParam(req.params.id),
        req.user!,
        req.body
      );
      res.json({
        success: true,
        data: result,
        message: "Marks saved for verification",
      });
    } catch (error) {
      next(error);
    }
  },

  async addSubject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await examService.addExamSubject(getParam(req.params.id), req.user!, req.body);
      res.status(201).json({ success: true, data, message: "Timetable entry added" });
    } catch (error) {
      next(error);
    }
  },

  async updateSubject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await examService.updateExamSubject(
        getParam(req.params.id),
        getParam(req.params.subjectId),
        req.user!,
        req.body ?? {}
      );
      res.json({ success: true, data, message: "Timetable entry updated" });
    } catch (error) {
      next(error);
    }
  },

  async deleteSubject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await examService.deleteExamSubject(
        getParam(req.params.id),
        getParam(req.params.subjectId),
        req.user!
      );
      res.json({ success: true, data, message: "Timetable entry removed" });
    } catch (error) {
      next(error);
    }
  },

  async submitMarks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await examService.submitMarks(
        getParam(req.params.id),
        req.user!,
        req.body.examSubjectId,
        Array.isArray(req.body?.studentIds) ? req.body.studentIds : undefined
      );
      res.json({ success: true, data, message: "Marks submitted for review" });
    } catch (error) {
      next(error);
    }
  },

  async reviewMarks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await examService.reviewMarks(
        getParam(req.params.id),
        req.user!,
        req.body.examSubjectId,
        { approved: req.body.approved, rejected: req.body.rejected }
      );
      res.json({ success: true, data, message: "Marks reviewed" });
    } catch (error) {
      next(error);
    }
  },

  async roster(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const subjectId = typeof req.query.examSubjectId === "string" ? req.query.examSubjectId : "";
      const data = await examService.getMarksRoster(getParam(req.params.id), subjectId, req.user!);
      res.json({ success: true, data, message: "Marks roster retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async myExams(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await examService.getTeacherExams(req.user!);
      res.json({ success: true, data, message: "Assigned exams retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async reportCard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const studentId = typeof req.query.studentId === "string" ? req.query.studentId : "";
      const format = req.query.format === "pdf" ? "pdf" : "json";
      const report = await examService.getReportCard(getParam(req.params.id), studentId, req.user!);
      if (format === "pdf") {
        const { pdfService } = await import("../services/pdfService");
        const school = await examService.getReportSchool(report);
        const buffer = await pdfService.generateReportCardPdf({ ...report, school } as any);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="report-card-${report.student.admissionNumber}.pdf"`
        );
        res.send(buffer);
        return;
      }
      res.json({ success: true, data: report, message: "Report card retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async reminders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { notificationService } = await import("../services/notificationService");
      const schoolId =
        (typeof req.body?.schoolId === "string" && req.body.schoolId) ||
        req.user!.schoolId ||
        undefined;
      const data = await notificationService.examReminders(
        schoolId,
        typeof req.body?.hoursAhead === "number" ? req.body.hoursAhead : 168,
        !!req.user!.isSuperAdmin
      );
      res.json({ success: true, data, message: "Exam reminders queued" });
    } catch (error) {
      next(error);
    }
  },
};