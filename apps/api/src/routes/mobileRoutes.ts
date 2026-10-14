import { Router } from "express";
import { mobileController } from "../controllers/mobileController";
import { academicsController } from "../controllers/academicsController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/errorHandler";
import { uploadSingle } from "../middleware/upload";
import {
  homeworkIdParamSchema,
  updateCompletionsSchema,
  studentSubmitHomeworkSchema,
  assignmentIdParamSchema,
  gradeSubmissionsSchema,
  studentSubmitAssignmentSchema,
} from "../validators/academicsValidator";

const router = Router();

router.use(authenticate);

// Shared
router.get("/me", mobileController.me);
router.get("/timetable", mobileController.timetable);
router.get("/notifications", mobileController.notifications);
router.get("/announcements", mobileController.announcements);

// Student (service enforces STUDENT role + own-record scoping)
router.get("/dashboard", mobileController.studentDashboard);
router.get("/attendance", mobileController.attendance);
router.get("/homework", mobileController.homework);
router.post(
  "/homework/:id/submit",
  validate(studentSubmitHomeworkSchema),
  mobileController.submitHomework
);
router.get("/assignments", mobileController.studentAssignments);
router.post(
  "/assignments/:id/submit",
  validate(studentSubmitAssignmentSchema),
  mobileController.submitAssignment
);
router.post(
  "/assignments/attachments",
  uploadSingle("file"),
  mobileController.uploadAssignmentFile
);
router.get("/assignments/attachments/:docId", mobileController.downloadAssignmentFile);
router.get("/exams", mobileController.exams);
router.get("/results", mobileController.results);
router.get("/report-card/:id", mobileController.reportCard);
router.get("/fees", mobileController.fees);
router.get("/library", mobileController.library);
router.get("/transport", mobileController.transport);

// Teacher (service enforces TEACHER role + assigned-class scoping)
router.get("/teacher/dashboard", mobileController.teacherDashboard);
router.get("/teacher/classes", mobileController.teacherClasses);
router.get("/teacher/students", mobileController.teacherStudents);
router.get("/teacher/homework", mobileController.teacherHomework);
router.get(
  "/teacher/homework/:id/completions",
  validate(homeworkIdParamSchema),
  academicsController.homeworkCompletions
);
router.patch(
  "/teacher/homework/:id/completions",
  validate(updateCompletionsSchema),
  academicsController.updateCompletions
);
router.get("/teacher/assignments", mobileController.teacherAssignments);
router.get(
  "/teacher/assignments/:id/submissions",
  validate(assignmentIdParamSchema),
  mobileController.teacherSubmissions
);
router.get("/teacher/exams/:id/roster", mobileController.teacherMarksRoster);
router.post("/teacher/exams/:id/marks/submit", mobileController.teacherSubmitMarks);
router.patch(
  "/teacher/assignments/:id/grade",
  validate(gradeSubmissionsSchema),
  mobileController.teacherGrade
);
router.post(
  "/teacher/assignments/:id/publish-grades",
  validate(assignmentIdParamSchema),
  mobileController.teacherPublishGrades
);

export default router;
