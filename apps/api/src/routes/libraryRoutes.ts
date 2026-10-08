import { Router } from "express";
import { libraryController } from "../controllers/libraryController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  createBookSchema,
  updateBookSchema,
  createIssueSchema,
  returnBookSchema,
} from "../validators/libraryValidator";

const router = Router();

router.use(authenticate);

router.get("/dashboard", authorize(PERMISSIONS.LIBRARY_VIEW), libraryController.dashboard);
router.get("/issues", authorize(PERMISSIONS.LIBRARY_VIEW), libraryController.listIssues);
router.get("/", authorize(PERMISSIONS.LIBRARY_VIEW), libraryController.listBooks);
router.get("/:bookId", authorize(PERMISSIONS.LIBRARY_VIEW), libraryController.getBookById);
router.post(
  "/",
  authorize(PERMISSIONS.LIBRARY_ISSUE),
  validate(createBookSchema),
  libraryController.createBook
);
router.post(
  "/issues",
  authorize(PERMISSIONS.LIBRARY_ISSUE),
  validate(createIssueSchema),
  libraryController.issueBook
);
router.put(
  "/:bookId",
  authorize(PERMISSIONS.LIBRARY_ISSUE),
  validate(updateBookSchema),
  libraryController.updateBook
);
router.patch(
  "/issues/:issueId/return",
  authorize(PERMISSIONS.LIBRARY_RETURN),
  validate(returnBookSchema),
  libraryController.returnBook
);
router.delete(
  "/:bookId",
  authorize(PERMISSIONS.LIBRARY_ISSUE),
  libraryController.deleteBook
);

export default router;