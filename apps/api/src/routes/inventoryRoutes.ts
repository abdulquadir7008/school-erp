import { Router } from "express";
import { inventoryController } from "../controllers/inventoryController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  createItemSchema,
  updateItemSchema,
  createTransactionSchema,
  createAssetSchema,
  updateAssetSchema,
} from "../validators/inventoryValidator";

const router = Router();

router.use(authenticate);

/* Dashboard */
router.get("/dashboard", authorize(PERMISSIONS.INVENTORY_VIEW), inventoryController.dashboard);

/* Stock items */
router.get("/items", authorize(PERMISSIONS.INVENTORY_VIEW), inventoryController.listItems);
router.post(
  "/items",
  authorize(PERMISSIONS.INVENTORY_CREATE),
  validate(createItemSchema),
  inventoryController.createItem
);
router.put(
  "/items/:itemId",
  authorize(PERMISSIONS.INVENTORY_EDIT),
  validate(updateItemSchema),
  inventoryController.updateItem
);
router.delete(
  "/items/:itemId",
  authorize(PERMISSIONS.INVENTORY_EDIT),
  inventoryController.deleteItem
);

/* Transactions */
router.get(
  "/transactions",
  authorize(PERMISSIONS.INVENTORY_VIEW),
  inventoryController.listTransactions
);
router.post(
  "/transactions",
  authorize(PERMISSIONS.INVENTORY_EDIT),
  validate(createTransactionSchema),
  inventoryController.createTransaction
);

/* Assets */
router.get("/assets", authorize(PERMISSIONS.INVENTORY_VIEW), inventoryController.listAssets);
router.post(
  "/assets",
  authorize(PERMISSIONS.INVENTORY_CREATE),
  validate(createAssetSchema),
  inventoryController.createAsset
);
router.put(
  "/assets/:assetId",
  authorize(PERMISSIONS.INVENTORY_EDIT),
  validate(updateAssetSchema),
  inventoryController.updateAsset
);
router.delete(
  "/assets/:assetId",
  authorize(PERMISSIONS.INVENTORY_EDIT),
  inventoryController.deleteAsset
);

export default router;