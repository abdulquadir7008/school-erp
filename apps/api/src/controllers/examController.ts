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
        req.user?.isSuperAdmin || false
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
        req.user?.isSuperAdmin || false
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
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const result = await examService.list({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        search,
        status,
        schoolId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
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
        req.user?.isSuperAdmin || false
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
};