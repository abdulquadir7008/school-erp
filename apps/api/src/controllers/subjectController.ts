import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { subjectService } from "../services/subjectService";
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

export const subjectController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");

      const subject = await subjectService.create({
        ...req.body,
        schoolId,
      });

      res.status(201).json({
        success: true,
        data: subject,
        message: "Subject added successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const subject = await subjectService.getById(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: subject,
        message: "Subject retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const subject = await subjectService.update(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: subject,
        message: "Subject updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await subjectService.delete(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: result,
        message: "Subject deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const result = await subjectService.list({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        search,
        schoolId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });

      res.json({
        success: true,
        data: result.data,
        message: "Subjects retrieved",
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  },

  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const stats = await subjectService.getDashboardStats(
        schoolId,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: stats,
        message: "Academics stats retrieved",
      });
    } catch (error) {
      next(error);
    }
  },
};