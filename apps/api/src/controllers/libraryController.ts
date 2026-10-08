import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { libraryService } from "../services/libraryService";
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

export const libraryController = {
  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const stats = await libraryService.getDashboardStats(
        schoolId,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: stats,
        message: "Library dashboard stats retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async listBooks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const category = typeof req.query.category === "string" ? req.query.category : undefined;
      const result = await libraryService.listBooks({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        search,
        category,
        schoolId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
        message: "Books retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async getBookById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const book = await libraryService.getBookById(
        getParam(req.params.bookId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: book,
        message: "Book retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async createBook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");

      const book = await libraryService.createBook({
        ...req.body,
        schoolId,
      });

      res.status(201).json({
        success: true,
        data: book,
        message: "Book added to library",
      });
    } catch (error) {
      next(error);
    }
  },

  async updateBook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const book = await libraryService.updateBook(
        getParam(req.params.bookId),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: book,
        message: "Book updated",
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteBook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await libraryService.deleteBook(
        getParam(req.params.bookId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: result,
        message: "Book removed from library",
      });
    } catch (error) {
      next(error);
    }
  },

  async listIssues(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
      const result = await libraryService.listIssues({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        status,
        studentId,
        schoolId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
        message: "Issues retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async issueBook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");

      const issue = await libraryService.issueBook(
        {
          ...req.body,
          schoolId,
        },
        req.user?.isSuperAdmin || false
      );

      res.status(201).json({
        success: true,
        data: issue,
        message: "Book issued to student",
      });
    } catch (error) {
      next(error);
    }
  },

  async returnBook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const updated = await libraryService.returnBook(
        getParam(req.params.issueId),
        getContextSchoolId(req),
        req.body.fine,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: updated,
        message: "Book returned",
      });
    } catch (error) {
      next(error);
    }
  },
};