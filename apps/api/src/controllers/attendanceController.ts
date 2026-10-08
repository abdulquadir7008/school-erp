import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { attendanceService } from "../services/attendanceService";
import { TenantError } from "../utils/errors";

const getContextSchoolId = (req: AuthRequest): string | undefined => {
  if (req.user?.isSuperAdmin) {
    return (req.body.schoolId || req.query.schoolId) as string | undefined;
  }
  return req.user?.schoolId || undefined;
};

export const attendanceController = {
  async roster(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
      const sectionId =
        typeof req.query.sectionId === "string" && req.query.sectionId
          ? req.query.sectionId
          : undefined;
      const date = typeof req.query.date === "string" ? req.query.date : undefined;

      if (!classId) throw new TenantError("Class selection required");

      const result = await attendanceService.roster({
        classId,
        sectionId,
        date,
        schoolId: getContextSchoolId(req),
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });

      res.json({
        success: true,
        data: result,
        message: "Attendance roster retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async bulkCreate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");

      const result = await attendanceService.bulkCreate({
        date: req.body.date,
        classId: req.body.classId,
        schoolId,
        records: req.body.records,
        markedBy: req.user?.id,
      });

      res.json({
        success: true,
        data: result,
        message: "Attendance saved successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async stats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const classId =
        typeof req.query.classId === "string" && req.query.classId
          ? req.query.classId
          : undefined;
      const date = typeof req.query.date === "string" ? req.query.date : undefined;

      const stats = await attendanceService.stats({
        classId,
        date,
        schoolId: getContextSchoolId(req),
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });

      res.json({
        success: true,
        data: stats,
        message: "Attendance stats retrieved",
      });
    } catch (error) {
      next(error);
    }
  },
};