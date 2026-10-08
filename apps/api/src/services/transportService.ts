import { prisma } from "../config/database";
import { ConflictError, NotFoundError, TenantError } from "../utils/errors";

interface VehicleData {
  registrationNo?: string;
  type?: string;
  capacity?: number;
  status?: string;
  schoolId: string;
}

interface DriverData {
  name?: string;
  phone?: string;
  licenseNo?: string;
  vehicleId?: string | null;
  schoolId: string;
}

interface RouteData {
  name?: string;
  vehicleId?: string;
  startTime?: string | null;
  endTime?: string | null;
  schoolId: string;
}

interface StopData {
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  time?: string | null;
  position?: number;
}

interface AssignmentData {
  studentId: string;
  routeId: string;
  vehicleId: string;
  stopId?: string | null;
  schoolId: string;
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

export const transportService = {
  /* ---------------- Dashboard ---------------- */

  async getDashboardStats(schoolId: string | undefined, isSuperAdmin = false) {
    const scope = DEFAULT_SCOPE(schoolId, isSuperAdmin);

    const [vehicleCount, activeVehicles, driversCount, assignedStudents, totalCapacity] =
      await Promise.all([
        prisma.vehicle.count({ where: scope }),
        prisma.vehicle.count({ where: { ...scope, status: "ACTIVE" } }),
        prisma.driver.count({ where: scope }),
        prisma.studentTransport.count({ where: scope }),
        prisma.vehicle.aggregate({
          where: { ...scope, capacity: { not: null } },
          _sum: { capacity: true },
        }),
      ]);

    const routeRows = await prisma.route.findMany({
      where: scope,
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNo: true,
            type: true,
            capacity: true,
            status: true,
            driver: {
              select: { id: true, name: true, phone: true, licenseNo: true },
            },
          },
        },
        _count: {
          select: {
            stops: true,
            assignments: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const routeIds = routeRows.map((r) => r.id);
    const allStops = routeIds.length
      ? await prisma.routeStop.findMany({
          where: { routeId: { in: routeIds } },
          orderBy: { position: "asc" },
          select: { id: true, routeId: true, name: true, position: true, time: true },
        })
      : [];

    const routeSummary = routeRows.map((r) => {
      const vehicle = r.vehicle;
      const stops = allStops.filter((s) => s.routeId === r.id);
      const capacity = vehicle.capacity || 0;
      return {
        id: r.id,
        name: r.name,
        startTime: r.startTime,
        endTime: r.endTime,
        stopsCount: r._count.stops,
        studentsCount: r._count.assignments,
        vehicle: {
          id: vehicle.id,
          registrationNo: vehicle.registrationNo,
          type: vehicle.type,
          capacity,
          status: vehicle.status,
          seatsAvailable: Math.max(0, capacity - r._count.assignments),
        },
        driver: vehicle.driver || null,
        stops,
        occupancy: capacity > 0 ? Math.round((r._count.assignments / capacity) * 100) : 0,
      };
    });

    return {
      vehicles: vehicleCount,
      activeVehicles,
      drivers: driversCount,
      routes: routeSummary,
      assignedStudents,
      totalCapacity: totalCapacity._sum.capacity ?? 0,
      seatUtilization:
        totalCapacity._sum.capacity
          ? Math.round((assignedStudents / totalCapacity._sum.capacity) * 100)
          : 0,
    };
  },

  /* ---------------- Vehicles ---------------- */

  async listVehicles(query: {
    schoolId?: string;
    isSuperAdmin?: boolean;
  }) {
    const scope = DEFAULT_SCOPE(query.schoolId, !!query.isSuperAdmin);
    const vehicles = await prisma.vehicle.findMany({
      where: scope,
      include: {
        driver: { select: { id: true, name: true, phone: true, licenseNo: true } },
        _count: {
          select: { routes: true, assignments: true },
        },
      },
      orderBy: { registrationNo: "asc" },
    });
    return vehicles;
  },

  async createVehicle(data: VehicleData, isSuperAdmin = false) {
    requireSchool(data.schoolId, isSuperAdmin);

    const existing = await prisma.vehicle.findUnique({
      where: {
        schoolId_registrationNo: {
          schoolId: data.schoolId,
          registrationNo: data.registrationNo!,
        },
      },
    });
    if (existing) {
      throw new ConflictError("A vehicle with this registration number already exists");
    }

    return prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: {
          registrationNo: data.registrationNo!,
          type: data.type || "Bus",
          capacity: data.capacity ?? 45,
          status: data.status || "ACTIVE",
          schoolId: data.schoolId,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "VEHICLE",
          entityId: vehicle.id,
          schoolId: data.schoolId,
          newValue: { registrationNo: vehicle.registrationNo, type: vehicle.type },
        },
      });
      return vehicle;
    });
  },

  async updateVehicle(
    id: string,
    schoolId: string | undefined,
    data: VehicleData,
    isSuperAdmin = false
  ) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new NotFoundError("Vehicle");
    if (!isSuperAdmin && vehicle.schoolId !== schoolId) throw new TenantError();

    if (data.registrationNo) {
      const existing = await prisma.vehicle.findFirst({
        where: {
          schoolId: vehicle.schoolId,
          registrationNo: data.registrationNo,
          id: { not: id },
        },
      });
      if (existing) throw new ConflictError("Registration number already in use");
    }

    if (data.capacity && data.capacity < (await prisma.studentTransport.count({ where: { vehicleId: id } }))) {
      throw new ConflictError("Capacity cannot be less than currently assigned students");
    }

    return prisma.vehicle.update({
      where: { id },
      data: {
        registrationNo: data.registrationNo,
        type: data.type,
        capacity: data.capacity,
        status: data.status,
      },
    });
  },

  async deleteVehicle(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new NotFoundError("Vehicle");
    if (!isSuperAdmin && vehicle.schoolId !== schoolId) throw new TenantError();

    const routes = await prisma.route.findMany({
      where: { vehicleId: id },
      select: { id: true },
    });
    const routeIds = routes.map((r) => r.id);
    const assignments = await prisma.studentTransport.count({
      where: {
        OR: [{ vehicleId: id }, ...(routeIds.length ? [{ routeId: { in: routeIds } }] : [])],
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.studentTransport.deleteMany({
        where: {
          OR: [{ vehicleId: id }, ...(routeIds.length ? [{ routeId: { in: routeIds } }] : [])],
        },
      });
      if (routeIds.length) {
        await tx.route.deleteMany({ where: { id: { in: routeIds } } });
      }
      await tx.driver.updateMany({ where: { vehicleId: id }, data: { vehicleId: null } });
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "VEHICLE",
          entityId: id,
          schoolId: vehicle.schoolId,
          oldValue: {
            registrationNo: vehicle.registrationNo,
            removedRoutes: routeIds.length,
            removedAssignments: assignments,
          },
        },
      });
      await tx.vehicle.delete({ where: { id } });
    });
    return {
      success: true,
      removedRoutes: routeIds.length,
      removedAssignments: assignments,
    };
  },

  /* ---------------- Drivers ---------------- */

  async listDrivers(query: { schoolId?: string; isSuperAdmin?: boolean }) {
    const scope = DEFAULT_SCOPE(query.schoolId, !!query.isSuperAdmin);
    const drivers = await prisma.driver.findMany({
      where: scope,
      include: {
        vehicle: {
          select: { id: true, registrationNo: true, type: true, capacity: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return drivers;
  },

  async createDriver(data: DriverData, isSuperAdmin = false) {
    requireSchool(data.schoolId, isSuperAdmin);

    if (data.vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle) throw new NotFoundError("Vehicle");
      if (vehicle.schoolId !== data.schoolId) {
        throw new TenantError("Vehicle does not belong to this school");
      }
      const busy = await prisma.driver.findFirst({ where: { vehicleId: data.vehicleId } });
      if (busy) throw new ConflictError("This vehicle already has a driver assigned");
    }

    return prisma.$transaction(async (tx) => {
      const driver = await tx.driver.create({
        data: {
          name: data.name!,
          phone: data.phone!,
          licenseNo: data.licenseNo,
          vehicleId: data.vehicleId || null,
          schoolId: data.schoolId,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "DRIVER",
          entityId: driver.id,
          schoolId: data.schoolId,
          newValue: { name: driver.name },
        },
      });
      return driver;
    });
  },

  async updateDriver(
    id: string,
    schoolId: string | undefined,
    data: DriverData,
    isSuperAdmin = false
  ) {
    const driver = await prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundError("Driver");
    if (!isSuperAdmin && driver.schoolId !== schoolId) throw new TenantError();

    if (data.vehicleId !== undefined && data.vehicleId !== null && data.vehicleId !== driver.vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle) throw new NotFoundError("Vehicle");
      if (vehicle.schoolId !== driver.schoolId) {
        throw new TenantError("Vehicle does not belong to this school");
      }
      const busy = await prisma.driver.findFirst({
        where: { vehicleId: data.vehicleId, id: { not: id } },
      });
      if (busy) throw new ConflictError("This vehicle already has a driver assigned");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.driver.update({
        where: { id },
        data: {
          name: data.name,
          phone: data.phone,
          licenseNo: data.licenseNo,
          vehicleId: data.vehicleId === undefined ? undefined : data.vehicleId,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "DRIVER",
          entityId: id,
          schoolId: driver.schoolId,
          oldValue: { name: driver.name },
          newValue: { name: updated.name },
        },
      });
      return updated;
    });
  },

  async deleteDriver(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const driver = await prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundError("Driver");
    if (!isSuperAdmin && driver.schoolId !== schoolId) throw new TenantError();

    await prisma.driver.delete({ where: { id } });
    return { success: true };
  },

  /* ---------------- Routes ---------------- */

  async listRoutes(query: {
    vehicleId?: string;
    schoolId?: string;
    isSuperAdmin?: boolean;
  }) {
    const requireSchoolScope =
      !query.isSuperAdmin && !query.schoolId;
    if (requireSchoolScope) {
      throw new TenantError("School context required");
    }

    const where: any = {};
    if (query.schoolId) where.schoolId = query.schoolId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;

    const routes = await prisma.route.findMany({
      where,
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNo: true,
            type: true,
            capacity: true,
            status: true,
            driver: {
              select: { id: true, name: true, phone: true, licenseNo: true },
            },
          },
        },
        stops: { orderBy: { position: "asc" } },
        _count: { select: { assignments: true } },
      },
      orderBy: { name: "asc" },
    });
    return routes;
  },

  async getRouteById(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const route = await prisma.route.findUnique({
      where: { id },
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNo: true,
            type: true,
            capacity: true,
            status: true,
            driver: {
              select: { id: true, name: true, phone: true, licenseNo: true },
            },
          },
        },
        stops: { orderBy: { position: "asc" } },
        assignments: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                class: { select: { name: true } },
              },
            },
          },
          take: 50,
        },
        _count: { select: { assignments: true } },
      },
    });
    if (!route) throw new NotFoundError("Route");
    if (!isSuperAdmin && route.schoolId !== schoolId) throw new TenantError();
    return route;
  },

  async createRoute(data: RouteData & { stops?: StopData[] }, isSuperAdmin = false) {
    requireSchool(data.schoolId, isSuperAdmin);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId! } });
    if (!vehicle) throw new NotFoundError("Vehicle");
    if (vehicle.schoolId !== data.schoolId) {
      throw new TenantError("Vehicle does not belong to this school");
    }

    const existing = await prisma.route.findFirst({
      where: { schoolId: data.schoolId, name: data.name },
    });
    if (existing) throw new ConflictError("A route with this name already exists");

    return prisma.$transaction(async (tx) => {
      const route = await tx.route.create({
        data: {
          name: data.name!,
          vehicleId: data.vehicleId!,
          schoolId: data.schoolId,
          startTime: data.startTime || null,
          endTime: data.endTime || null,
          stops: data.stops?.length
            ? {
                create: data.stops.map((s, i) => ({
                  name: s.name!,
                  position: s.position ?? i,
                  latitude: s.latitude ?? null,
                  longitude: s.longitude ?? null,
                  time: s.time ?? null,
                })),
              }
            : undefined,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "ROUTE",
          entityId: route.id,
          schoolId: data.schoolId,
          newValue: { name: route.name, vehicleId: route.vehicleId },
        },
      });
      return route;
    });
  },

  async updateRoute(
    id: string,
    schoolId: string | undefined,
    data: RouteData,
    isSuperAdmin = false
  ) {
    const route = await prisma.route.findUnique({ where: { id } });
    if (!route) throw new NotFoundError("Route");
    if (!isSuperAdmin && route.schoolId !== schoolId) throw new TenantError();

    if (data.vehicleId && data.vehicleId !== route.vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle) throw new NotFoundError("Vehicle");
      if (vehicle.schoolId !== route.schoolId) {
        throw new TenantError("Vehicle does not belong to this school");
      }
    }

    return prisma.route.update({
      where: { id },
      data: {
        name: data.name,
        vehicleId: data.vehicleId,
        startTime: data.startTime === undefined ? undefined : data.startTime,
        endTime: data.endTime === undefined ? undefined : data.endTime,
      },
    });
  },

  async deleteRoute(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const route = await prisma.route.findUnique({ where: { id } });
    if (!route) throw new NotFoundError("Route");
    if (!isSuperAdmin && route.schoolId !== schoolId) throw new TenantError();

    const assignments = await prisma.studentTransport.count({ where: { routeId: id } });
    if (assignments > 0) {
      throw new ConflictError("Cannot delete a route with assigned students");
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "ROUTE",
          entityId: id,
          schoolId: route.schoolId,
          oldValue: { name: route.name },
        },
      });
      await tx.route.delete({ where: { id } });
    });
    return { success: true };
  },

  /* ---------------- Stops ---------------- */

  async addStop(
    routeId: string,
    schoolId: string | undefined,
    data: StopData,
    isSuperAdmin = false
  ) {
    const route = await prisma.route.findUnique({ where: { id: routeId } });
    if (!route) throw new NotFoundError("Route");
    if (!isSuperAdmin && route.schoolId !== schoolId) throw new TenantError();

    const count = await prisma.routeStop.count({ where: { routeId } });
    const position = data.position ?? count;

    return prisma.routeStop.create({
      data: {
        routeId,
        name: data.name!,
        position,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        time: data.time ?? null,
      },
    });
  },

  async updateStop(
    id: string,
    schoolId: string | undefined,
    data: StopData,
    isSuperAdmin = false
  ) {
    const stop = await prisma.routeStop.findUnique({
      where: { id },
      include: { route: { select: { schoolId: true } } },
    });
    if (!stop) throw new NotFoundError("Stop");
    if (!isSuperAdmin && stop.route.schoolId !== schoolId) throw new TenantError();

    return prisma.routeStop.update({
      where: { id },
      data: {
        name: data.name,
        latitude: data.latitude === undefined ? undefined : data.latitude,
        longitude: data.longitude === undefined ? undefined : data.longitude,
        time: data.time === undefined ? undefined : data.time,
        position: data.position,
      },
    });
  },

  async deleteStop(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const stop = await prisma.routeStop.findUnique({
      where: { id },
      include: { route: { select: { schoolId: true } } },
    });
    if (!stop) throw new NotFoundError("Stop");
    if (!isSuperAdmin && stop.route.schoolId !== schoolId) throw new TenantError();

    await prisma.$transaction(async (tx) => {
      await tx.studentTransport.updateMany({
        where: { stopId: id },
        data: { stopId: null },
      });
      await tx.routeStop.delete({ where: { id } });
    });
    return { success: true };
  },

  /* ---------------- Assignments ---------------- */

  async listAssignments(query: {
    routeId?: string;
    studentId?: string;
    schoolId?: string;
    isSuperAdmin?: boolean;
  }) {
    if (!query.isSuperAdmin && !query.schoolId) {
      throw new TenantError("School context required");
    }

    const where: any = {};
    if (query.schoolId) where.schoolId = query.schoolId;
    if (query.routeId) where.routeId = query.routeId;
    if (query.studentId) where.studentId = query.studentId;

    const assignments = await prisma.studentTransport.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            class: { select: { name: true } },
          },
        },
        route: { select: { id: true, name: true, startTime: true, endTime: true } },
        vehicle: {
          select: { id: true, registrationNo: true, type: true, capacity: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const stopIds = assignments
      .map((a) => a.stopId)
      .filter((s): s is string => !!s);
    const stops = stopIds.length
      ? await prisma.routeStop.findMany({
          where: { id: { in: stopIds } },
          select: { id: true, name: true, time: true, position: true },
        })
      : [];

    return assignments.map((a) => ({
      ...a,
      stop: stops.find((s) => s.id === a.stopId) || null,
    }));
  },

  async createAssignment(data: AssignmentData, isSuperAdmin = false) {
    requireSchool(data.schoolId, isSuperAdmin);

    const [student, route, vehicle] = await Promise.all([
      prisma.student.findUnique({ where: { id: data.studentId } }),
      prisma.route.findUnique({ where: { id: data.routeId } }),
      prisma.vehicle.findUnique({ where: { id: data.vehicleId } }),
    ]);
    if (!student) throw new NotFoundError("Student");
    if (!route) throw new NotFoundError("Route");
    if (!vehicle) throw new NotFoundError("Vehicle");

    const assignmentSchoolId = route.schoolId;
    if (data.schoolId && data.schoolId !== assignmentSchoolId) {
      throw new TenantError("Route belongs to a different school");
    }
    if (!isSuperAdmin && data.schoolId !== assignmentSchoolId) {
      throw new TenantError();
    }
    if (student.schoolId !== assignmentSchoolId) {
      throw new TenantError("Student does not belong to the route's school");
    }
    if (vehicle.schoolId !== assignmentSchoolId) {
      throw new TenantError("Vehicle does not belong to the route's school");
    }

    const existing = await prisma.studentTransport.findFirst({
      where: { studentId: data.studentId },
    });
    if (existing) {
      throw new ConflictError("This student is already assigned to a bus");
    }

    const capacity = vehicle.capacity || 0;
    const enrolled = await prisma.studentTransport.count({ where: { vehicleId: data.vehicleId } });
    if (capacity > 0 && enrolled >= capacity) {
      throw new ConflictError("This bus is at full capacity");
    }

    if (data.stopId) {
      const stop = await prisma.routeStop.findUnique({ where: { id: data.stopId } });
      if (!stop) throw new NotFoundError("Stop");
      if (stop.routeId !== data.routeId) {
        throw new ConflictError("Stop does not belong to the selected route");
      }
    }

    return prisma.$transaction(async (tx) => {
      const assignment = await tx.studentTransport.create({
        data: {
          studentId: data.studentId,
          routeId: data.routeId,
          vehicleId: data.vehicleId,
          stopId: data.stopId ?? null,
          schoolId: assignmentSchoolId,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "TRANSPORT_ASSIGNMENT",
          entityId: assignment.id,
          schoolId: assignmentSchoolId,
          newValue: {
            student: `${student.firstName} ${student.lastName}`,
            route: route.name,
            vehicle: vehicle.registrationNo,
          },
        },
      });
      return assignment;
    });
  },

  async deleteAssignment(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const assignment = await prisma.studentTransport.findUnique({
      where: { id },
      include: { route: { select: { schoolId: true } } },
    });
    if (!assignment) throw new NotFoundError("Transport assignment");
    if (!isSuperAdmin && assignment.route.schoolId !== schoolId) throw new TenantError();

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "TRANSPORT_ASSIGNMENT",
          entityId: id,
          schoolId: assignment.route.schoolId,
          oldValue: { studentId: assignment.studentId },
        },
      });
      await tx.studentTransport.delete({ where: { id } });
    });
    return { success: true };
  },

  /* ---------------- My Transport (parent / student) ---------------- */

  async getMyTransport(reqUser: {
    email?: string;
    roleName?: string;
    schoolId?: string | null;
  }) {
    let studentIds: string[] = [];

    if (reqUser.roleName === "STUDENT") {
      const student = reqUser.email
        ? await prisma.student.findFirst({
            where: { email: reqUser.email },
            include: { school: { select: { id: true, name: true } } },
          })
        : null;
      if (student) studentIds = [student.id];
    } else {
      const parent = reqUser.email
        ? await prisma.parent.findFirst({
            where: { email: reqUser.email },
            include: { school: { select: { id: true, name: true } } },
          })
        : null;
      if (parent) {
        const links = await prisma.studentParent.findMany({
          where: { parentId: parent.id },
          select: { studentId: true },
        });
        studentIds = links.map((l) => l.studentId);
      }
    }

    if (studentIds.length === 0) {
      return { children: [], emergencyContact: null };
    }

    const assignments = await prisma.studentTransport.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
        route: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            schoolId: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            registrationNo: true,
            type: true,
            capacity: true,
            status: true,
          },
        },
      },
    });

    const routeIds = assignments.map((a) => a.routeId);
    const routeStops = await prisma.routeStop.findMany({
      where: { routeId: { in: routeIds } },
      orderBy: [{ routeId: "asc" }, { position: "asc" }],
    });

    const vehicleIds = assignments.map((a) => a.vehicleId);
    const drivers = await prisma.driver.findMany({
      where: { vehicleId: { in: vehicleIds } },
      select: { id: true, name: true, phone: true, licenseNo: true, vehicleId: true },
    });

    const children = await Promise.all(
      assignments.map(async (a) => {
        const stops = routeStops
          .filter((s) => s.routeId === a.routeId)
          .sort((x, y) => x.position - y.position);
        const pickupStop = stops.find((s) => s.id === a.stopId) || stops.find((s) => s.position > 0) || null;
        const schoolStop = stops.find((s) => s.position === stops.length - 1) || null;
        const driver = drivers.find((d) => d.vehicleId === a.vehicleId) || null;

        const enrolled = await prisma.studentTransport.count({
          where: { vehicleId: a.vehicleId, routeId: a.routeId },
        });
        const capacity = a.vehicle.capacity || 0;

        return {
          student: {
            id: a.student.id,
            firstName: a.student.firstName,
            lastName: a.student.lastName,
            admissionNumber: a.student.admissionNumber,
            className: a.student.class?.name,
            sectionName: a.student.section?.name,
          },
          vehicle: {
            id: a.vehicle.id,
            registrationNo: a.vehicle.registrationNo,
            type: a.vehicle.type,
            capacity,
            status: a.vehicle.status,
            seatsAvailable: Math.max(0, capacity - enrolled),
          },
          route: {
            id: a.route.id,
            name: a.route.name,
            startTime: a.route.startTime,
            endTime: a.route.endTime,
          },
          driver,
          pickupStop,
          schoolStop,
          stops,
        };
      })
    );

    const school = await prisma.school.findFirst({
      where: { id: assignments[0].route.schoolId },
      select: { name: true, phone: true, email: true },
    });

    return {
      children,
      emergencyContact: {
        schoolName: school?.name ?? "",
        schoolPhone: school?.phone ?? "",
        schoolEmail: school?.email ?? "",
      },
    };
  },
};