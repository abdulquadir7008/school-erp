import { prisma } from "../config/database";
import { ConflictError, NotFoundError, TenantError } from "../utils/errors";

interface ItemData {
  code?: string;
  name?: string;
  category?: string;
  description?: string | null;
  unit?: string;
  quantity?: number;
  minStock?: number;
  purchasePrice?: number | null;
  department?: string | null;
  location?: string | null;
  schoolId: string;
}

interface AssetData {
  name?: string;
  assetCode?: string;
  category?: string;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  warrantyExpiry?: string | null;
  location?: string | null;
  condition?: string | null;
  assignedTo?: string | null;
  department?: string | null;
  schoolId: string;
}

interface TransactionData {
  itemId: string;
  type: "IN" | "OUT" | "ADJUST";
  quantity: number;
  note?: string | null;
  schoolId?: string;
}

function requireSchool(schoolId: string | undefined, isSuperAdmin: boolean) {
  if (!schoolId && !isSuperAdmin) {
    throw new TenantError("School context required");
  }
}

const DEFAULT_SCOPE = (schoolId: string | undefined, isSuperAdmin: boolean) => {
  requireSchool(schoolId, isSuperAdmin);
  return schoolId ? { schoolId } : {};
};

const num = (d: unknown): number | null => (d == null ? null : Number(d));

const stockStatus = (quantity: number, minStock: number) =>
  quantity <= 0 ? "OUT" : quantity <= minStock ? "LOW" : "OK";

const serializeItem = (i: any) => ({
  ...i,
  purchasePrice: num(i.purchasePrice),
  stockStatus: stockStatus(i.quantity ?? 0, i.minStock ?? 0),
  _count: i._count
    ? { transactions: i._count.transactions }
    : undefined,
});

const serializeAsset = (a: any) => ({
  ...a,
  purchasePrice: num(a.purchasePrice),
});

export const inventoryService = {
  /* ---------------- Dashboard ---------------- */

  async getDashboardStats(schoolId: string | undefined, isSuperAdmin = false) {
    const scope = DEFAULT_SCOPE(schoolId, isSuperAdmin);

    const items = await prisma.inventoryItem.findMany({ where: scope });

    const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));
    const departments = Array.from(new Set(items.map((i) => i.department).filter(Boolean)));

    const lowStock = items.filter(
      (i) => i.quantity > 0 && i.quantity <= i.minStock
    ).length;
    const outOfStock = items.filter((i) => i.quantity <= 0).length;
    const totalValue = items.reduce(
      (sum, i) => sum + (Number(i.purchasePrice) || 0) * i.quantity,
      0
    );

    const byCategory = categories.map((c) => ({
      category: c,
      count: items.filter((i) => i.category === c).length,
    }));

    const byDepartment = departments.map((d) => ({
      department: d,
      count: items.filter((i) => i.department === d).length,
    }));

    const [assetsCount, recentTransactions] = await Promise.all([
      prisma.asset.count({ where: scope }),
      prisma.inventoryTransaction.findMany({
        where: { item: scope.schoolId ? { schoolId: scope.schoolId } : {} },
        include: {
          item: { select: { id: true, name: true, code: true, unit: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

    return {
      totalItems: items.length,
      categories: categories.length,
      departments: departments.length,
      lowStock,
      outOfStock,
      totalValue,
      assetsCount,
      byCategory,
      byDepartment,
      recentTransactions,
    };
  },

  /* ---------------- Stock items ---------------- */

  async listItems(schoolId: string | undefined, isSuperAdmin = false) {
    const scope = DEFAULT_SCOPE(schoolId, isSuperAdmin);
    const items = await prisma.inventoryItem.findMany({
      where: scope,
      include: { _count: { select: { transactions: true } } },
      orderBy: { createdAt: "desc" },
    });
    return items.map(serializeItem);
  },

  async createItem(data: ItemData, isSuperAdmin = false) {
    requireSchool(data.schoolId, isSuperAdmin);
    const existing = await prisma.inventoryItem.findUnique({
      where: { schoolId_code: { schoolId: data.schoolId, code: data.code! } },
    });
    if (existing) throw new ConflictError("An item with this code already exists");

    return prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          code: data.code!,
          name: data.name!,
          category: data.category!,
          description: data.description || null,
          unit: data.unit || "unit",
          quantity: data.quantity ?? 0,
          minStock: data.minStock ?? 0,
          purchasePrice: data.purchasePrice ?? null,
          department: data.department || null,
          location: data.location || null,
          schoolId: data.schoolId,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "INVENTORY_ITEM",
          entityId: item.id,
          schoolId: data.schoolId,
          newValue: { code: item.code, name: item.name, quantity: item.quantity },
        },
      });
      return serializeItem(item);
    });
  },

  async updateItem(
    id: string,
    schoolId: string | undefined,
    data: ItemData,
    isSuperAdmin = false
  ) {
    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundError("Inventory item");
    if (!isSuperAdmin && item.schoolId !== schoolId) throw new TenantError();

    if (data.code && data.code !== item.code) {
      const dup = await prisma.inventoryItem.findFirst({
        where: { schoolId: item.schoolId, code: data.code, id: { not: id } },
      });
      if (dup) throw new ConflictError("An item with this code already exists");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({
        where: { id },
        data: {
          code: data.code,
          name: data.name,
          category: data.category,
          description: data.description === undefined ? undefined : data.description,
          unit: data.unit,
          quantity: data.quantity,
          minStock: data.minStock,
          purchasePrice:
            data.purchasePrice === undefined ? undefined : data.purchasePrice,
          department: data.department === undefined ? undefined : data.department,
          location: data.location === undefined ? undefined : data.location,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "INVENTORY_ITEM",
          entityId: id,
          schoolId: item.schoolId,
          oldValue: { name: item.name, quantity: item.quantity },
          newValue: { name: updated.name, quantity: updated.quantity },
        },
      });
      return serializeItem(updated);
    });
  },

  async deleteItem(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundError("Inventory item");
    if (!isSuperAdmin && item.schoolId !== schoolId) throw new TenantError();

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "INVENTORY_ITEM",
          entityId: id,
          schoolId: item.schoolId,
          oldValue: { name: item.name, code: item.code },
        },
      });
      await tx.inventoryItem.delete({ where: { id } });
    });
    return { success: true };
  },

  /* ---------------- Transactions ---------------- */

  async listTransactions(schoolId: string | undefined, isSuperAdmin = false) {
    const scope = DEFAULT_SCOPE(schoolId, isSuperAdmin);
    return prisma.inventoryTransaction.findMany({
      where: { item: scope.schoolId ? { schoolId: scope.schoolId } : {} },
      include: {
        item: { select: { id: true, name: true, code: true, unit: true, category: true, department: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  },

  async createTransaction(
    data: TransactionData,
    performedBy: string | undefined,
    isSuperAdmin = false
  ) {
    const item = await prisma.inventoryItem.findUnique({ where: { id: data.itemId } });
    if (!item) throw new NotFoundError("Inventory item");

    const schoolId = data.schoolId ?? item.schoolId;
    if (!isSuperAdmin && item.schoolId !== schoolId) throw new TenantError();
    requireSchool(schoolId, isSuperAdmin);

    let newQuantity: number;
    if (data.type === "IN") {
      newQuantity = item.quantity + data.quantity;
    } else if (data.type === "OUT") {
      if (item.quantity < data.quantity) {
        throw new ConflictError(
          `Not enough stock — only ${item.quantity} ${item.unit} available`
        );
      }
      newQuantity = item.quantity - data.quantity;
    } else {
      newQuantity = data.quantity;
    }

    return prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: newQuantity },
      });
      const txRecord = await tx.inventoryTransaction.create({
        data: {
          itemId: item.id,
          type: data.type,
          quantity: data.quantity,
          note: data.note || null,
          performedBy,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "INVENTORY_ITEM",
          entityId: item.id,
          schoolId: item.schoolId,
          oldValue: { quantity: item.quantity },
          newValue: { quantity: newQuantity, type: data.type },
        },
      });
      return {
        ...txRecord,
        item: { id: item.id, name: item.name, code: item.code, unit: item.unit },
        newQuantity,
      };
    });
  },

  /* ---------------- Assets ---------------- */

  async listAssets(schoolId: string | undefined, isSuperAdmin = false) {
    const scope = DEFAULT_SCOPE(schoolId, isSuperAdmin);
    const assets = await prisma.asset.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
    });
    return assets.map(serializeAsset);
  },

  async createAsset(data: AssetData, isSuperAdmin = false) {
    requireSchool(data.schoolId, isSuperAdmin);
    const existing = await prisma.asset.findUnique({
      where: { schoolId_assetCode: { schoolId: data.schoolId, assetCode: data.assetCode! } },
    });
    if (existing) throw new ConflictError("An asset with this code already exists");

    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          name: data.name!,
          assetCode: data.assetCode!,
          category: data.category!,
          serialNumber: data.serialNumber || null,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
          purchasePrice: data.purchasePrice ?? null,
          warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : null,
          location: data.location || null,
          condition: data.condition || "Good",
          assignedTo: data.assignedTo || null,
          department: data.department || null,
          schoolId: data.schoolId,
          status: "ACTIVE",
        },
      });
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "ASSET",
          entityId: asset.id,
          schoolId: data.schoolId,
          newValue: { assetCode: asset.assetCode, name: asset.name },
        },
      });
      return serializeAsset(asset);
    });
  },

  async updateAsset(
    id: string,
    schoolId: string | undefined,
    data: AssetData & { status?: string },
    isSuperAdmin = false
  ) {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundError("Asset");
    if (!isSuperAdmin && asset.schoolId !== schoolId) throw new TenantError();

    if (data.assetCode && data.assetCode !== asset.assetCode) {
      const dup = await prisma.asset.findFirst({
        where: { schoolId: asset.schoolId, assetCode: data.assetCode, id: { not: id } },
      });
      if (dup) throw new ConflictError("An asset with this code already exists");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.asset.update({
        where: { id },
        data: {
          name: data.name,
          assetCode: data.assetCode,
          category: data.category,
          serialNumber: data.serialNumber === undefined ? undefined : data.serialNumber,
          purchaseDate:
            data.purchaseDate === undefined
              ? undefined
              : data.purchaseDate
              ? new Date(data.purchaseDate)
              : null,
          purchasePrice:
            data.purchasePrice === undefined ? undefined : data.purchasePrice,
          warrantyExpiry:
            data.warrantyExpiry === undefined
              ? undefined
              : data.warrantyExpiry
              ? new Date(data.warrantyExpiry)
              : null,
          location: data.location === undefined ? undefined : data.location,
          condition: data.condition,
          assignedTo: data.assignedTo === undefined ? undefined : data.assignedTo,
          department: data.department === undefined ? undefined : data.department,
          status: data.status,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "ASSET",
          entityId: id,
          schoolId: asset.schoolId,
          oldValue: { assetCode: asset.assetCode, name: asset.name },
          newValue: { assetCode: updated.assetCode, status: updated.status },
        },
      });
      return serializeAsset(updated);
    });
  },

  async deleteAsset(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundError("Asset");
    if (!isSuperAdmin && asset.schoolId !== schoolId) throw new TenantError();

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "ASSET",
          entityId: id,
          schoolId: asset.schoolId,
          oldValue: { assetCode: asset.assetCode, name: asset.name },
        },
      });
      await tx.asset.delete({ where: { id } });
    });
    return { success: true };
  },
};