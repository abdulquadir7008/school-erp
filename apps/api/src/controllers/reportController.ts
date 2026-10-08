import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { reportService } from "../services/reportService";

const getContextSchoolId = (req: AuthRequest): string | undefined => {
  if (req.user?.isSuperAdmin) {
    return (req.body.schoolId || req.query.schoolId || req.params.schoolId) as
      | string
      | undefined;
  }
  return req.user?.schoolId || undefined;
};

const int = (v: unknown, fallback: number) => {
  const n = typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isNaN(n) ? fallback : n;
};

export const reportController = {
  async overview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await reportService.overview(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false,
        int(req.query.month, new Date().getMonth() + 1),
        int(req.query.year, new Date().getFullYear())
      );
      res.json({ success: true, data: stats, message: "Overview report retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async students(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportService.students(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data, message: "Student report retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async attendance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportService.attendance(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false,
        int(req.query.month, new Date().getMonth() + 1),
        int(req.query.year, new Date().getFullYear())
      );
      res.json({ success: true, data, message: "Attendance report retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async finance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportService.finance(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false,
        int(req.query.year, new Date().getFullYear())
      );
      res.json({ success: true, data, message: "Finance report retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async hr(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportService.hr(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false,
        int(req.query.month, new Date().getMonth() + 1),
        int(req.query.year, new Date().getFullYear())
      );
      res.json({ success: true, data, message: "HR report retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async library(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportService.library(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data, message: "Library report retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async transport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportService.transport(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data, message: "Transport report retrieved" });
    } catch (error) {
      next(error);
    }
  },
};