import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { getParam } from "../utils/request";
import { studentService } from "../services/studentService";
import { TenantError } from "../utils/errors";

const getContextSchoolId = (req: AuthRequest): string | undefined => {
  if (req.user?.isSuperAdmin) {
    return (req.body.schoolId || req.query.schoolId || req.params.schoolId) as
      | string
      | undefined;
  }
  return req.user?.schoolId || undefined;
};

export const studentController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");

      const student = await studentService.create({
        ...req.body,
        schoolId,
      });

      res.status(201).json({
        success: true,
        data: student,
        message: "Student admitted successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const result = await studentService.list({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        search,
        classId,
        sectionId,
        status,
        schoolId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });

      res.json({
        success: true,
        data: result.data,
        message: "Students retrieved",
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const student = await studentService.getById(
        getParam(req.params.id),
        schoolId,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: student,
        message: "Student retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const student = await studentService.update(
        getParam(req.params.id),
        schoolId,
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: student,
        message: "Student updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const result = await studentService.delete(
        getParam(req.params.id),
        schoolId,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: result,
        message: "Student transferred",
      });
    } catch (error) {
      next(error);
    }
  },

  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const stats = await studentService.getDashboardStats(
        schoolId,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: stats,
        message: "Student stats retrieved",
      });
    } catch (error) {
      next(error);
    }
  },
};