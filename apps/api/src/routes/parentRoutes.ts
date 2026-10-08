import { Router } from "express";
import { parentController } from "../controllers/parentController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import { createParentSchema, updateParentSchema } from "../validators/parentValidator";

const router = Router();

router.use(authenticate);

router.get("/dashboard", authorize(PERMISSIONS.PARENT_VIEW), parentController.dashboard);
router.get("/", authorize(PERMISSIONS.PARENT_VIEW), parentController.list);
router.get("/:id", authorize(PERMISSIONS.PARENT_VIEW), parentController.getById);
router.post(
  "/",
  authorize(PERMISSIONS.PARENT_CREATE),
  validate(createParentSchema),
  parentController.create
);
router.put(
  "/:id",
  authorize(PERMISSIONS.PARENT_EDIT),
  validate(updateParentSchema),
  parentController.update
);
router.delete(
  "/:id",
  authorize(PERMISSIONS.PARENT_DELETE),
  parentController.delete
);

export default router;
