/**
 * Creates (or resets the password of) the global Super Admin.
 *
 * Usage (from repo root, pointed at ANY database — local or production):
 *   DATABASE_URL="<postgres-connection-string>" npx tsx apps/api/src/scripts/create-super-admin.ts [email] [password]
 *
 * Defaults: admin@schoolsphere.test / Admin@2024
 * The API must have booted at least once against the database so the
 * SUPER_ADMIN role exists (roles self-initialize on server start).
 */
import bcrypt from "bcryptjs";
import { prisma } from "../config/database";

const email = (process.argv[2] || "admin@schoolsphere.test").toLowerCase();
const password = process.argv[3] || "Admin@2024";

async function main() {
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const role = await prisma.role.findUnique({
    where: { name: "SUPER_ADMIN" },
  });
  if (!role) {
    throw new Error(
      "SUPER_ADMIN role not found. Start the API once against this database so roles initialize, then retry."
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findFirst({
    where: { email, schoolId: null },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, roleId: role.id, isActive: true },
    });
    console.log(`Super admin password reset: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: "Super",
        lastName: "Admin",
        roleId: role.id,
      },
    });
    console.log(`Super admin created: ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
