import { Router } from "express";
import { attendanceController } from "../controllers/attendanceController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import { bulkAttendanceSchema } from "../validators/attendanceValidator";

const router = Router();

router.use(authenticate);

router.get("/roster", authorize(PERMISSIONS.ATTENDANCE_VIEW), attendanceController.roster);
router.get("/stats", authorize(PERMISSIONS.ATTENDANCE_VIEW), attendanceController.stats);
router.post(
  "/bulk",
  authorize(PERMISSIONS.ATTENDANCE_CREATE),
  validate(bulkAttendanceSchema),
  attendanceController.bulkCreate
);

export default router;