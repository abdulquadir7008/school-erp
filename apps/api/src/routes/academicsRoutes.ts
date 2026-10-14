import { Router } from "express";
import { academicsController } from "../controllers/academicsController";
import { assignmentController } from "../controllers/assignmentController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { uploadSingle } from "../middleware/upload";
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
  updateAssignmentSchema,
  assignmentIdParamSchema,
  gradeSubmissionsSchema,
  studentSubmitAssignmentSchema,
  publishGradesSchema,
  submissionHistorySchema,
  assignmentRemindersSchema,
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

// ---- Assignments (full lifecycle; teachers manage, students read/submit) ----
router.get("/assignments", authorize(PERMISSIONS.HOMEWORK_VIEW), assignmentController.list);
router.post(
  "/assignments",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(createAssignmentSchema),
  assignmentController.create
);
// Static sub-paths must be registered before "/assignments/:id".
router.post(
  "/assignments/attachments",
  authorize(PERMISSIONS.HOMEWORK_VIEW),
  uploadSingle("file"),
  assignmentController.upload
);
router.get(
  "/assignments/attachments/:docId",
  authorize(PERMISSIONS.HOMEWORK_VIEW),
  assignmentController.download
);
router.post(
  "/assignments/reminders",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(assignmentRemindersSchema),
  assignmentController.reminders
);
router.get(
  "/assignments/:id",
  authorize(PERMISSIONS.HOMEWORK_VIEW),
  validate(assignmentIdParamSchema),
  assignmentController.detail
);
router.put(
  "/assignments/:id",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(updateAssignmentSchema),
  assignmentController.update
);
router.delete(
  "/assignments/:id",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(assignmentIdParamSchema),
  assignmentController.remove
);
router.post(
  "/assignments/:id/publish",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(assignmentIdParamSchema),
  assignmentController.transition("PUBLISHED")
);
router.post(
  "/assignments/:id/close",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(assignmentIdParamSchema),
  assignmentController.transition("CLOSED")
);
router.post(
  "/assignments/:id/reopen",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(assignmentIdParamSchema),
  assignmentController.transition("PUBLISHED")
);
router.post(
  "/assignments/:id/archive",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(assignmentIdParamSchema),
  assignmentController.transition("ARCHIVED")
);
router.post(
  "/assignments/:id/duplicate",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(assignmentIdParamSchema),
  assignmentController.duplicate
);
router.get(
  "/assignments/:id/submissions",
  authorize(PERMISSIONS.HOMEWORK_VIEW),
  validate(assignmentIdParamSchema),
  assignmentController.submissions
);
router.patch(
  "/assignments/:id/grade",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(gradeSubmissionsSchema),
  assignmentController.grade
);
router.post(
  "/assignments/:id/publish-grades",
  authorize(PERMISSIONS.HOMEWORK_CREATE),
  validate(publishGradesSchema),
  assignmentController.publishGrades
);
router.post(
  "/assignments/:id/submit",
  authorize(PERMISSIONS.HOMEWORK_VIEW),
  validate(studentSubmitAssignmentSchema),
  assignmentController.submit
);
router.get(
  "/assignments/:id/history",
  authorize(PERMISSIONS.HOMEWORK_VIEW),
  validate(submissionHistorySchema),
  assignmentController.history
);

export default router;
