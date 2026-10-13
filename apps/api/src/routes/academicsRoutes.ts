import { Router } from "express";
import { academicsController } from "../controllers/academicsController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  createTimetableSchema,
  createHomeworkSchema,
  createAssignmentSchema,
} from "../validators/academicsValidator";

const router = Router();

router.use(authenticate);

router.get("/timetable", authorize(PERMISSIONS.TIMETABLE_VIEW), academicsController.timetable);
router.post(
  "/timetable",
  authorize(PERMISSIONS.TIMETABLE_EDIT),
  validate(createTimetableSchema),
  academicsController.createTimetable
);
router.delete(
  "/timetable/:id",
  authorize(PERMISSIONS.TIMETABLE_EDIT),
  academicsController.deleteTimetable
);

router.get("/homework", authorize(PERMISSIONS.HOMEWORK_VIEW), academicsController.homework);
router.post(
  "/homework",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(createHomeworkSchema),
  academicsController.createHomework
);

router.get("/assignments", authorize(PERMISSIONS.HOMEWORK_VIEW), academicsController.assignments);
router.post(
  "/assignments",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(createAssignmentSchema),
  academicsController.createAssignment
);

export default router;
