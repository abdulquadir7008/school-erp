import { Response } from "express";
import { tenantIsolation, getSchoolId } from "./tenant";
import { authorize } from "./authorization";
import { AuthRequest, AuthUser } from "../types";
import { authenticate } from "./auth";

const mockUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: "u1",
  email: "admin@school.test",
  firstName: "Test",
  lastName: "Admin",
  roleId: "r1",
  roleName: "SCHOOL_ADMIN",
  schoolId: "school-a",
  branchId: null,
  permissions: ["student.view", "student.create"],
  isSuperAdmin: false,
  ...overrides,
});

const buildReq = (user?: AuthUser): Partial<AuthRequest> & AuthRequest =>
  ({
    user,
    params: {},
    body: {},
    query: {},
    headers: {},
  } as unknown as AuthRequest);

const mockRes = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

describe("Tenant Isolation", () => {
  it("blocks access to another school's data via params", () => {
    const req = buildReq(mockUser());
    req.params = { schoolId: "school-b" };
    const next = jest.fn();
    tenantIsolation(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "TENANT_VIOLATION" }));
  });

  it("blocks access to another school's data via body", () => {
    const req = buildReq(mockUser());
    req.body = { schoolId: "school-z" };
    const next = jest.fn();
    tenantIsolation(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "TENANT_VIOLATION" }));
  });

  it("allows matching schoolId", () => {
    const req = buildReq(mockUser());
    req.body = { schoolId: "school-a" };
    const next = jest.fn();
    tenantIsolation(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("allows Super Admin with any school context", () => {
    const req = buildReq(mockUser({ isSuperAdmin: true, schoolId: null }));
    req.params = { schoolId: "any-school" };
    const next = jest.fn();
    tenantIsolation(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("returns schoolId from user context for non-super admins", () => {
    const req = buildReq(mockUser());
    req.body = { schoolId: "school-attacker" };
    expect(getSchoolId(req)).toBe("school-a");
  });
});

describe("Authorization Middleware", () => {
  it("allows user with required permission", () => {
    const req = buildReq(mockUser());
    const next = jest.fn();
    authorize("student.view")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects user missing a permission", () => {
    const req = buildReq(mockUser());
    const next = jest.fn();
    authorize("fees.collect")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "AUTHORIZATION_ERROR" }));
  });

  it("rejects unauthenticated requests", () => {
    const req = buildReq();
    const next = jest.fn();
    authorize("student.view")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "AUTHORIZATION_ERROR" }));
  });

  it("bypasses permission checks for super admin", () => {
    const req = buildReq(mockUser({ isSuperAdmin: true, permissions: [] }));
    const next = jest.fn();
    authorize("anything.at.all")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("Auth Middleware", () => {
  it("rejects missing Authorization header", () => {
    const req = buildReq();
    const next = jest.fn();
    authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "AUTHENTICATION_ERROR" }));
  });
});