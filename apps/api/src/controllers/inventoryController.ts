import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { inventoryService } from "../services/inventoryService";
import { TenantError } from "../utils/errors";
import { getParam } from "../utils/request";

const getContextSchoolId = (req: AuthRequest): string | undefined => {
  if (req.user?.isSuperAdmin) {
    return (req.body.schoolId || req.query.schoolId || req.params.schoolId) as
      | string
      | undefined;
  }
  return req.user?.schoolId || undefined;
};

export const inventoryController = {
  /* Dashboard */
  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await inventoryService.getDashboardStats(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: stats, message: "Inventory stats retrieved" });
    } catch (error) {
      next(error);
    }
  },

  /* Stock items */
  async listItems(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const items = await inventoryService.listItems(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: items, message: "Inventory items retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");
      const item = await inventoryService.createItem(
        { ...req.body, schoolId },
        req.user?.isSuperAdmin || false
      );
      res.status(201).json({ success: true, data: item, message: "Item added" });
    } catch (error) {
      next(error);
    }
  },

  async updateItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await inventoryService.updateItem(
        getParam(req.params.itemId),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: item, message: "Item updated" });
    } catch (error) {
      next(error);
    }
  },

  async deleteItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.deleteItem(
        getParam(req.params.itemId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: result, message: "Item removed" });
    } catch (error) {
      next(error);
    }
  },

  /* Transactions */
  async listTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const transactions = await inventoryService.listTransactions(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: transactions, message: "Transactions retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const transaction = await inventoryService.createTransaction(
        { ...req.body, schoolId: getContextSchoolId(req) },
        req.user?.id,
        req.user?.isSuperAdmin || false
      );
      res
        .status(201)
        .json({ success: true, data: transaction, message: "Stock movement recorded" });
    } catch (error) {
      next(error);
    }
  },

  /* Assets */
  async listAssets(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const assets = await inventoryService.listAssets(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: assets, message: "Assets retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createAsset(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");
      const asset = await inventoryService.createAsset(
        { ...req.body, schoolId },
        req.user?.isSuperAdmin || false
      );
      res.status(201).json({ success: true, data: asset, message: "Asset added" });
    } catch (error) {
      next(error);
    }
  },

  async updateAsset(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const asset = await inventoryService.updateAsset(
        getParam(req.params.assetId),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: asset, message: "Asset updated" });
    } catch (error) {
      next(error);
    }
  },

  async deleteAsset(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.deleteAsset(
        getParam(req.params.assetId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: result, message: "Asset removed" });
    } catch (error) {
      next(error);
    }
  },
};