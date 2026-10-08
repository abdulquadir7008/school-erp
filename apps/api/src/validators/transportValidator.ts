import { z } from "zod";

export const createVehicleSchema = z.object({
  body: z.object({
    registrationNo: z.string().min(1).max(50),
    type: z.string().max(50).optional(),
    capacity: z.number().int().min(1).max(500).optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).optional(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const updateVehicleSchema = z.object({
  body: z.object({
    registrationNo: z.string().min(1).max(50).optional(),
    type: z.string().max(50).optional(),
    capacity: z.number().int().min(1).max(500).optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).optional(),
  }),
});

export const createDriverSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    phone: z.string().min(1).max(30),
    licenseNo: z.string().max(50).optional(),
    vehicleId: z.string().uuid().optional(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const updateDriverSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    phone: z.string().min(1).max(30).optional(),
    licenseNo: z.string().max(50).optional(),
    vehicleId: z.string().uuid().nullable().optional(),
  }),
});

export const createRouteSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    vehicleId: z.string().uuid(),
    startTime: z.string().max(20).optional(),
    endTime: z.string().max(20).optional(),
    stops: z
      .array(
        z.object({
          name: z.string().min(1).max(200),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          time: z.string().max(20).optional(),
          position: z.number().int().optional(),
        })
      )
      .max(100)
      .optional(),
    schoolId: z.string().uuid().optional(),
  }),
});

export const updateRouteSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    vehicleId: z.string().uuid().optional(),
    startTime: z.string().max(20).nullable().optional(),
    endTime: z.string().max(20).nullable().optional(),
  }),
});

export const createStopSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    time: z.string().max(20).optional(),
    position: z.number().int().optional(),
  }),
});

export const updateStopSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    time: z.string().max(20).nullable().optional(),
    position: z.number().int().optional(),
  }),
});

export const createAssignmentSchema = z.object({
  body: z.object({
    studentId: z.string().uuid(),
    routeId: z.string().uuid(),
    vehicleId: z.string().uuid(),
    stopId: z.string().uuid().nullable().optional(),
    schoolId: z.string().uuid().optional(),
  }),
});