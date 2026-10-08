import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { transportService } from "../services/transportService";
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

export const transportController = {
  /* Dashboard */
  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const stats = await transportService.getDashboardStats(
        schoolId,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: stats,
        message: "Transport dashboard stats retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  /* My transport (parent/student) */
  async myTransport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await transportService.getMyTransport({
        email: req.user?.email,
        roleName: req.user?.roleName,
        schoolId: req.user?.schoolId,
      });
      res.json({
        success: true,
        data: result,
        message: "Transport information retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  /* Vehicles */
  async listVehicles(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const vehicles = await transportService.listVehicles({
        schoolId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });
      res.json({ success: true, data: vehicles, message: "Vehicles retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createVehicle(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");

      const vehicle = await transportService.createVehicle(
        { ...req.body, schoolId },
        req.user?.isSuperAdmin || false
      );
      res.status(201).json({
        success: true,
        data: vehicle,
        message: "Vehicle added",
      });
    } catch (error) {
      next(error);
    }
  },

  async updateVehicle(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const vehicle = await transportService.updateVehicle(
        getParam(req.params.vehicleId),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: vehicle, message: "Vehicle updated" });
    } catch (error) {
      next(error);
    }
  },

  async deleteVehicle(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await transportService.deleteVehicle(
        getParam(req.params.vehicleId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: result, message: "Vehicle removed" });
    } catch (error) {
      next(error);
    }
  },

  /* Drivers */
  async listDrivers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const drivers = await transportService.listDrivers({
        schoolId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });
      res.json({ success: true, data: drivers, message: "Drivers retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createDriver(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");

      const driver = await transportService.createDriver(
        { ...req.body, schoolId },
        req.user?.isSuperAdmin || false
      );
      res.status(201).json({
        success: true,
        data: driver,
        message: "Driver added",
      });
    } catch (error) {
      next(error);
    }
  },

  async updateDriver(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driver = await transportService.updateDriver(
        getParam(req.params.driverId),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: driver, message: "Driver updated" });
    } catch (error) {
      next(error);
    }
  },

  async deleteDriver(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await transportService.deleteDriver(
        getParam(req.params.driverId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: result, message: "Driver removed" });
    } catch (error) {
      next(error);
    }
  },

  /* Routes */
  async listRoutes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const vehicleId =
        typeof req.query.vehicleId === "string" ? req.query.vehicleId : undefined;
      const routes = await transportService.listRoutes({
        schoolId,
        vehicleId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });
      res.json({ success: true, data: routes, message: "Routes retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async getRouteById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const route = await transportService.getRouteById(
        getParam(req.params.routeId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: route, message: "Route retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createRoute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");

      const route = await transportService.createRoute(
        { ...req.body, schoolId },
        req.user?.isSuperAdmin || false
      );
      res.status(201).json({
        success: true,
        data: route,
        message: "Route created",
      });
    } catch (error) {
      next(error);
    }
  },

  async updateRoute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const route = await transportService.updateRoute(
        getParam(req.params.routeId),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: route, message: "Route updated" });
    } catch (error) {
      next(error);
    }
  },

  async deleteRoute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await transportService.deleteRoute(
        getParam(req.params.routeId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: result, message: "Route removed" });
    } catch (error) {
      next(error);
    }
  },

  /* Stops */
  async addStop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stop = await transportService.addStop(
        getParam(req.params.routeId),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.status(201).json({ success: true, data: stop, message: "Stop added" });
    } catch (error) {
      next(error);
    }
  },

  async updateStop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stop = await transportService.updateStop(
        getParam(req.params.stopId),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: stop, message: "Stop updated" });
    } catch (error) {
      next(error);
    }
  },

  async deleteStop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await transportService.deleteStop(
        getParam(req.params.stopId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: result, message: "Stop removed" });
    } catch (error) {
      next(error);
    }
  },

  /* Assignments */
  async listAssignments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const routeId = typeof req.query.routeId === "string" ? req.query.routeId : undefined;
      const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
      const assignments = await transportService.listAssignments({
        schoolId,
        routeId,
        studentId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });
      res.json({ success: true, data: assignments, message: "Assignments retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createAssignment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");

      const assignment = await transportService.createAssignment(
        { ...req.body, schoolId },
        req.user?.isSuperAdmin || false
      );
      res.status(201).json({
        success: true,
        data: assignment,
        message: "Student assigned to bus",
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteAssignment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await transportService.deleteAssignment(
        getParam(req.params.assignmentId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: result, message: "Assignment removed" });
    } catch (error) {
      next(error);
    }
  },
};