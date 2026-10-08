import { ROLES, PERMISSIONS } from "./permissions";

describe("RBAC Configuration", () => {
  it("defines all system roles", () => {
    const names = ROLES.map((r) => r.name);
    expect(names).toContain("SUPER_ADMIN");
    expect(names).toContain("SCHOOL_ADMIN");
    expect(names).toContain("PRINCIPAL");
    expect(names).toContain("TEACHER");
    expect(names).toContain("ACCOUNTANT");
    expect(names).toContain("STUDENT");
    expect(names).toContain("PARENT");
    expect(names).toContain("LIBRARIAN");
    expect(names).toContain("HR_MANAGER");
    expect(names).toContain("TRANSPORT_MANAGER");
  });

  it("marks all roles as system roles", () => {
    for (const role of ROLES) {
      expect(role.isSystem).toBe(true);
    }
  });

  it("gives SUPER_ADMIN access to all permissions", () => {
    const superAdmin = ROLES.find((r) => r.name === "SUPER_ADMIN");
    const allPermissions = Object.values(PERMISSIONS);
    for (const permission of allPermissions) {
      expect(superAdmin?.permissions).toContain(permission);
    }
  });

  it("gives TEACHER attendance and homework permissions", () => {
    const teacher = ROLES.find((r) => r.name === "TEACHER");
    expect(teacher?.permissions).toContain(PERMISSIONS.ATTENDANCE_CREATE);
    expect(teacher?.permissions).toContain(PERMISSIONS.HOMEWORK_CREATE);
    expect(teacher?.permissions).toContain(PERMISSIONS.STUDENT_VIEW);
  });

  it("rejects risky permissions for PARENT role", () => {
    const parent = ROLES.find((r) => r.name === "PARENT");
    expect(parent?.permissions).not.toContain(PERMISSIONS.STUDENT_DELETE);
    expect(parent?.permissions).not.toContain(PERMISSIONS.FEES_COLLECT);
    expect(parent?.permissions).not.toContain(PERMISSIONS.USER_EDIT);
  });

  it("does not let ACCOUNTANT access student data", () => {
    const accountant = ROLES.find((r) => r.name === "ACCOUNTANT");
    expect(accountant?.permissions).not.toContain(PERMISSIONS.STUDENT_VIEW);
  });

  it("all role definitions have unique names", () => {
    const names = ROLES.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});