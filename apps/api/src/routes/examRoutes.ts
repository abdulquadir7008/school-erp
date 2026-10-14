import { Router } from "express";
import { examController } from "../controllers/examController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  createExamSchema,
  updateExamSchema,
  updateExamStatusSchema,
  examIdParamSchema,
  addExamSubjectSchema,
  updateExamSubjectSchema,
  marksSubmitSchema,
  marksReviewSchema,
  reportCardQuerySchema,
  examRemindersSchema,
} from "../validators/examValidator";
import { enterMarksSchema } from "../validators/academicsValidator";

const router = Router();

router.use(authenticate);

router.get("/dashboard", authorize(PERMISSIONS.EXAM_VIEW), examController.dashboard);
router.get("/", authorize(PERMISSIONS.EXAM_VIEW), examController.list);
// Static sub-paths before "/:id".
router.get("/mine", authorize(PERMISSIONS.EXAM_VIEW), examController.myExams);
router.post(
  "/reminders",
  authorize(PERMISSIONS.EXAM_EDIT),
  validate(examRemindersSchema),
  examController.reminders
);
router.get("/:id", authorize(PERMISSIONS.EXAM_VIEW), examController.getById);
router.get("/:id/results", authorize(PERMISSIONS.EXAM_RESULTS), examController.getResults);
router.get(
  "/:id/report-card",
  authorize(PERMISSIONS.EXAM_RESULTS),
  validate(reportCardQuerySchema),
  examController.reportCard
);
router.get(
  "/:id/roster",
  authorize(PERMISSIONS.EXAM_MARKS),
  validate(examIdParamSchema),
  examController.roster
);
router.post(
  "/:id/marks",
  authorize(PERMISSIONS.EXAM_MARKS),
  validate(enterMarksSchema),
  examController.enterMarks
);
router.post(
  "/:id/marks/submit",
  authorize(PERMISSIONS.EXAM_MARKS),
  validate(marksSubmitSchema),
  examController.submitMarks
);
router.post(
  "/:id/marks/review",
  authorize(PERMISSIONS.EXAM_EDIT),
  validate(marksReviewSchema),
  examController.reviewMarks
);
router.post(
  "/:id/subjects",
  authorize(PERMISSIONS.EXAM_EDIT),
  validate(addExamSubjectSchema),
  examController.addSubject
);
router.put(
  "/:id/subjects/:subjectId",
  authorize(PERMISSIONS.EXAM_EDIT),
  validate(updateExamSubjectSchema),
  examController.updateSubject
);
router.delete(
  "/:id/subjects/:subjectId",
  authorize(PERMISSIONS.EXAM_EDIT),
  validate(examIdParamSchema),
  examController.deleteSubject
);
router.post(
  "/",
  authorize(PERMISSIONS.EXAM_CREATE),
  validate(createExamSchema),
  examController.create
);
router.put(
  "/:id",
  authorize(PERMISSIONS.EXAM_EDIT),
  validate(updateExamSchema),
  examController.update
);
router.patch(
  "/:id/status",
  authorize(PERMISSIONS.EXAM_EDIT),
  validate(updateExamStatusSchema),
  examController.updateStatus
);
router.delete(
  "/:id",
  authorize(PERMISSIONS.EXAM_EDIT),
  examController.delete
);

export default router;
