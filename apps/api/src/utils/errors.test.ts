import { AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError, TenantError } from "../utils/errors";

describe("Error Classes", () => {
  it("creates a generic AppError with proper metadata", () => {
    const err = new AppError("boom", 500, "INTERNAL");
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL");
    expect(err.isOperational).toBe(true);
  });

  it("creates a ValidationError with field errors", () => {
    const err = new ValidationError("Invalid data", [{ field: "name", message: "Required" }]);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.errors).toHaveLength(1);
  });

  it("creates standard HTTP error subclasses", () => {
    expect(new AuthenticationError().statusCode).toBe(401);
    expect(new AuthorizationError().statusCode).toBe(403);
    expect(new NotFoundError("School").message).toBe("School not found");
    expect(new ConflictError("dup").statusCode).toBe(409);
    expect(new TenantError().statusCode).toBe(403);
    expect(new TenantError().code).toBe("TENANT_VIOLATION");
  });
});

describe("Auth Token Utilities", () => {
  it("generates access + refresh tokens for a valid user", () => {
    const { generateTokens, verifyRefreshToken } = require("../middleware/auth");
    const tokens = generateTokens({
      id: "u1",
      email: "admin@school.test",
      firstName: "Test",
      lastName: "Admin",
      roleId: "r1",
      roleName: "SCHOOL_ADMIN",
      schoolId: "school-a",
      branchId: null,
      permissions: ["student.view"],
      isSuperAdmin: false,
    });
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.accessToken.split(".")).toHaveLength(3);

    const payload = verifyRefreshToken(tokens.refreshToken);
    expect(payload.id).toBe("u1");
  });
});