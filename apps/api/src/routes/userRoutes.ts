import { Router } from "express";
import { userController } from "../controllers/userController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  createUserSchema,
  updateUserSchema,
} from "../validators/userValidator";

const router = Router();

router.use(authenticate);

router.get("/", authorize(PERMISSIONS.USER_VIEW), userController.list);
router.get(
  "/audit-logs",
  authorize(PERMISSIONS.AUDIT_VIEW),
  userController.auditLogs
);
router.post(
  "/",
  authorize(PERMISSIONS.USER_CREATE),
  validate(createUserSchema),
  userController.create
);
router.put(
  "/:id",
  authorize(PERMISSIONS.USER_EDIT),
  validate(updateUserSchema),
  userController.update
);
router.delete("/:id", authorize(PERMISSIONS.USER_DELETE), userController.delete);

export default router;