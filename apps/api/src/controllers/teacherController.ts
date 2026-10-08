import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { teacherService } from "../services/teacherService";
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

export const teacherController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");

      const teacher = await teacherService.create({
        ...req.body,
        schoolId,
      });

      res.status(201).json({
        success: true,
        data: teacher,
        message: "Teacher added successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const teacher = await teacherService.getById(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: teacher,
        message: "Teacher retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const teacher = await teacherService.update(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: teacher,
        message: "Teacher updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await teacherService.delete(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: result,
        message: "Teacher removed successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const result = await teacherService.list({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        search,
        schoolId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });

      res.json({
        success: true,
        data: result.data,
        message: "Teachers retrieved",
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  },

  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const stats = await teacherService.getDashboardStats(
        schoolId,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: stats,
        message: "Teacher stats retrieved",
      });
    } catch (error) {
      next(error);
    }
  },
};