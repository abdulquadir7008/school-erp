import { Router } from "express";
import { transportController } from "../controllers/transportController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  createVehicleSchema,
  updateVehicleSchema,
  createDriverSchema,
  updateDriverSchema,
  createRouteSchema,
  updateRouteSchema,
  createStopSchema,
  updateStopSchema,
  createAssignmentSchema,
} from "../validators/transportValidator";

const router = Router();

router.use(authenticate);

// Personal view (parents/students) - auth only, no special permission
router.get("/my", transportController.myTransport);

router.get("/dashboard", authorize(PERMISSIONS.TRANSPORT_VIEW), transportController.dashboard);
router.get("/vehicles", authorize(PERMISSIONS.TRANSPORT_VIEW), transportController.listVehicles);
router.get("/drivers", authorize(PERMISSIONS.TRANSPORT_VIEW), transportController.listDrivers);
router.get("/routes", authorize(PERMISSIONS.TRANSPORT_VIEW), transportController.listRoutes);
router.get("/routes/:routeId", authorize(PERMISSIONS.TRANSPORT_VIEW), transportController.getRouteById);
router.get("/assignments", authorize(PERMISSIONS.TRANSPORT_VIEW), transportController.listAssignments);

router.post(
  "/vehicles",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  validate(createVehicleSchema),
  transportController.createVehicle
);
router.put(
  "/vehicles/:vehicleId",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  validate(updateVehicleSchema),
  transportController.updateVehicle
);
router.delete(
  "/vehicles/:vehicleId",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  transportController.deleteVehicle
);

router.post(
  "/drivers",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  validate(createDriverSchema),
  transportController.createDriver
);
router.put(
  "/drivers/:driverId",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  validate(updateDriverSchema),
  transportController.updateDriver
);
router.delete(
  "/drivers/:driverId",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  transportController.deleteDriver
);

router.post(
  "/routes",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  validate(createRouteSchema),
  transportController.createRoute
);
router.put(
  "/routes/:routeId",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  validate(updateRouteSchema),
  transportController.updateRoute
);
router.delete(
  "/routes/:routeId",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  transportController.deleteRoute
);

router.post(
  "/routes/:routeId/stops",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  validate(createStopSchema),
  transportController.addStop
);
router.put(
  "/stops/:stopId",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  validate(updateStopSchema),
  transportController.updateStop
);
router.delete(
  "/stops/:stopId",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  transportController.deleteStop
);

router.post(
  "/assignments",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  validate(createAssignmentSchema),
  transportController.createAssignment
);
router.delete(
  "/assignments/:assignmentId",
  authorize(PERMISSIONS.TRANSPORT_EDIT),
  transportController.deleteAssignment
);

export default router;