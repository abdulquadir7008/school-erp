import { Router } from "express";
import { academicsController } from "../controllers/academicsController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  createTimetableSchema,
  createHomeworkSchema,
  updateHomeworkSchema,
  homeworkIdParamSchema,
  updateCompletionsSchema,
  studentSubmitHomeworkSchema,
  homeworkRemindersSchema,
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
router.get(
  "/homework/:id",
  authorize(PERMISSIONS.HOMEWORK_VIEW),
  validate(homeworkIdParamSchema),
  academicsController.homeworkDetail
);
router.put(
  "/homework/:id",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(updateHomeworkSchema),
  academicsController.updateHomework
);
router.delete(
  "/homework/:id",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(homeworkIdParamSchema),
  academicsController.deleteHomework
);
router.post(
  "/homework/:id/publish",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(homeworkIdParamSchema),
  academicsController.publishHomework
);
router.get(
  "/homework/:id/completions",
  authorize(PERMISSIONS.HOMEWORK_VIEW),
  validate(homeworkIdParamSchema),
  academicsController.homeworkCompletions
);
router.patch(
  "/homework/:id/completions",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(updateCompletionsSchema),
  academicsController.updateCompletions
);
router.post(
  "/homework/:id/submit",
  authorize(PERMISSIONS.HOMEWORK_VIEW),
  validate(studentSubmitHomeworkSchema),
  academicsController.submitHomework
);
router.post(
  "/homework/reminders",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(homeworkRemindersSchema),
  academicsController.homeworkReminders
);

router.get("/assignments", authorize(PERMISSIONS.HOMEWORK_VIEW), academicsController.assignments);
router.post(
  "/assignments",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(createAssignmentSchema),
  academicsController.createAssignment
);

export default router;
