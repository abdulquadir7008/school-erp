import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STOCK_ITEMS: Array<{
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minStock: number;
  purchasePrice: number;
  department: string;
  location: string;
}> = [
  { code: "STK-001", name: "A4 Copy Paper (Ream)", category: "Stationery", unit: "ream", quantity: 42, minStock: 10, purchasePrice: 320, department: "Administration", location: "Store Room A" },
  { code: "STK-002", name: "Ballpoint Pens (Box of 50)", category: "Stationery", unit: "box", quantity: 15, minStock: 8, purchasePrice: 450, department: "Administration", location: "Store Room A" },
  { code: "STK-003", name: "Notebooks (College Ruled)", category: "Stationery", unit: "pack", quantity: 120, minStock: 40, purchasePrice: 180, department: "Administration", location: "Store Room A" },
  { code: "STK-004", name: "Whiteboard Markers (Set of 10)", category: "Stationery", unit: "set", quantity: 6, minStock: 10, purchasePrice: 240, department: "Mathematics", location: "Staff Room" },
  { code: "STK-005", name: "Microscope Slides (Box)", category: "Science Lab", unit: "box", quantity: 18, minStock: 6, purchasePrice: 550, department: "Science", location: "Science Lab" },
  { code: "STK-006", name: "Bunsen Burner Gas Hose", category: "Science Lab", unit: "unit", quantity: 3, minStock: 5, purchasePrice: 380, department: "Science", location: "Science Lab" },
  { code: "STK-007", name: "Litmus Paper (Vial)", category: "Science Lab", unit: "vial", quantity: 0, minStock: 10, purchasePrice: 120, department: "Science", location: "Science Lab" },
  { code: "STK-008", name: "Football", category: "Sports", unit: "unit", quantity: 12, minStock: 4, purchasePrice: 900, department: "Physical Education", location: "Sports Store" },
  { code: "STK-009", name: "Cricket Bats (Junior)", category: "Sports", unit: "unit", quantity: 4, minStock: 3, purchasePrice: 2400, department: "Physical Education", location: "Sports Store" },
  { code: "STK-010", name: "Printer Toner (HP 12A)", category: "IT & Electronics", unit: "unit", quantity: 2, minStock: 4, purchasePrice: 1800, department: "Computer Science", location: "IT Store" },
  { code: "STK-011", name: "USB-C Cables (1m)", category: "IT & Electronics", unit: "unit", quantity: 25, minStock: 10, purchasePrice: 250, department: "Computer Science", location: "IT Store" },
  { code: "STK-012", name: "Disposable Gloves (Box)", category: "Housekeeping", unit: "box", quantity: 30, minStock: 12, purchasePrice: 220, department: "Administration", location: "Store Room B" },
];

const ASSETS: Array<{
  assetCode: string;
  name: string;
  category: string;
  serialNumber: string;
  purchaseYear: number;
  purchasePrice: number;
  location: string;
  condition: string;
  assignedTo: string;
  department: string;
}> = [
  { assetCode: "AST-001", name: "HP ProBook Laptop", category: "Computer", serialNumber: "5CG8234ABC", purchaseYear: 2023, purchasePrice: 54000, location: "Staff Room", condition: "Good", assignedTo: "ICT Admin", department: "Computer Science" },
  { assetCode: "AST-002", name: "Overhead Projector", category: "Audio Visual", serialNumber: "PRJ-2291", purchaseYear: 2022, purchasePrice: 68000, location: "Science Lab", condition: "Needs Repair", assignedTo: "Science Dept", department: "Science" },
  { assetCode: "AST-003", name: "Laboratory Microscope Set", category: "Lab Equipment", serialNumber: "MSC-7781", purchaseYear: 2022, purchasePrice: 95000, location: "Science Lab", condition: "Excellent", assignedTo: "Science Dept", department: "Science" },
  { assetCode: "AST-004", name: "Classroom Desk", category: "Furniture", serialNumber: "", purchaseYear: 2020, purchasePrice: 6500, location: "Room 204", condition: "Good", assignedTo: "", department: "Administration" },
];

async function main() {
  const schools = await prisma.school.findMany({ select: { id: true, schoolCode: true, name: true } });
  console.log(`Found ${schools.length} school(s)`);

  for (const school of schools) {
    const existing = await prisma.inventoryItem.count({ where: { schoolId: school.id } });
    if (existing > 0) {
      console.log(`[${school.schoolCode}] skipped stock (${existing} items already exist)`);
      continue;
    }

    for (const item of STOCK_ITEMS) {
      await prisma.inventoryItem.create({
        data: {
          code: item.code,
          name: item.name,
          category: item.category,
          unit: item.unit,
          quantity: item.quantity,
          minStock: item.minStock,
          purchasePrice: item.purchasePrice,
          department: item.department,
          location: item.location,
          schoolId: school.id,
        },
      });
      await prisma.inventoryTransaction.create({
        data: {
          item: { connect: { schoolId_code: { schoolId: school.id, code: item.code } } },
          type: "IN",
          quantity: item.quantity === 0 ? 10 : item.quantity,
          note: "Initial stock (seed)",
        },
      });
    }

    for (const asset of ASSETS) {
      await prisma.asset.create({
        data: {
          name: asset.name,
          assetCode: asset.assetCode,
          category: asset.category,
          serialNumber: asset.serialNumber || null,
          purchaseDate: new Date(`${asset.purchaseYear}-04-01T00:00:00.000Z`),
          purchasePrice: asset.purchasePrice,
          location: asset.location,
          condition: asset.condition,
          assignedTo: asset.assignedTo || null,
          department: asset.department,
          schoolId: school.id,
          status: asset.condition === "Needs Repair" ? "MAINTENANCE" : "ACTIVE",
        },
      });
    }

    console.log(`[${school.schoolCode}] seeded ${STOCK_ITEMS.length} stock items + ${ASSETS.length} assets`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });