import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { AuthorizationError } from "../utils/errors";

export const authorize = (...requiredPermissions: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthorizationError("Not authenticated"));
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    const hasPermission = requiredPermissions.every((permission) =>
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      return next(
        new AuthorizationError(
          `Required permissions: ${requiredPermissions.join(", ")}`
        )
      );
    }

    next();
  };
};

export const requireSchoolAccess = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AuthorizationError("Not authenticated"));
  }

  if (req.user.isSuperAdmin) {
    return next();
  }

  if (!req.user.schoolId) {
    return next(new AuthorizationError("No school context"));
  }

  next();
};
