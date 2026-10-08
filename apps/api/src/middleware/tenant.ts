import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { TenantError } from "../utils/errors";

export const tenantIsolation = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new TenantError("Not authenticated"));
  }

  if (req.user.isSuperAdmin) {
    return next();
  }

  if (!req.user.schoolId) {
    return next(new TenantError("No school context"));
  }

  const requestSchoolId = req.params.schoolId || req.body.schoolId || req.query.schoolId;

  if (requestSchoolId && requestSchoolId !== req.user.schoolId) {
    return next(new TenantError("Cannot access another school's data"));
  }

  next();
};

export const getSchoolId = (req: AuthRequest): string => {
  if (req.user?.isSuperAdmin) {
    return req.params.schoolId || req.body.schoolId || (req.query.schoolId as string) || "";
  }
  return req.user?.schoolId || "";
};
