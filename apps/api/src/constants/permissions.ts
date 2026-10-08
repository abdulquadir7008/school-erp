export type RoleName =
  | "SUPER_ADMIN"
  | "SCHOOL_ADMIN"
  | "BRANCH_ADMIN"
  | "PRINCIPAL"
  | "VICE_PRINCIPAL"
  | "TEACHER"
  | "ACCOUNTANT"
  | "HR_MANAGER"
  | "LIBRARIAN"
  | "TRANSPORT_MANAGER"
  | "RECEPTIONIST"
  | "STAFF"
  | "STUDENT"
  | "PARENT";

export const PERMISSIONS = {
  // Student
  STUDENT_VIEW: "student.view",
  STUDENT_CREATE: "student.create",
  STUDENT_EDIT: "student.edit",
  STUDENT_DELETE: "student.delete",

  // Parent
  PARENT_VIEW: "parent.view",
  PARENT_CREATE: "parent.create",
  PARENT_EDIT: "parent.edit",
  PARENT_DELETE: "parent.delete",

  // Teacher
  TEACHER_VIEW: "teacher.view",
  TEACHER_CREATE: "teacher.create",
  TEACHER_EDIT: "teacher.edit",
  TEACHER_DELETE: "teacher.delete",

  // Attendance
  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_CREATE: "attendance.create",
  ATTENDANCE_EDIT: "attendance.edit",

  // Fees
  FEES_VIEW: "fees.view",
  FEES_MANAGE: "fees.manage",
  FEES_COLLECT: "fees.collect",
  FEES_REFUND: "fees.refund",
  FEES_REPORT: "fees.report",

  // Exams
  EXAM_VIEW: "exam.view",
  EXAM_CREATE: "exam.create",
  EXAM_EDIT: "exam.edit",
  EXAM_PUBLISH: "exam.publish",
  EXAM_RESULTS: "exam.results",

  // Academics
  ACADEMICS_VIEW: "academics.view",
  ACADEMICS_CREATE: "academics.create",
  ACADEMICS_EDIT: "academics.edit",

  // Timetable
  TIMETABLE_VIEW: "timetable.view",
  TIMETABLE_EDIT: "timetable.edit",

  // Homework
  HOMEWORK_VIEW: "homework.view",
  HOMEWORK_CREATE: "homework.create",

  // Library
  LIBRARY_VIEW: "library.view",
  LIBRARY_ISSUE: "library.issue",
  LIBRARY_RETURN: "library.return",

  // Transport
  TRANSPORT_VIEW: "transport.view",
  TRANSPORT_EDIT: "transport.edit",

  // HR
  HR_VIEW: "hr.view",
  HR_CREATE: "hr.create",
  HR_EDIT: "hr.edit",

  // Payroll
  PAYROLL_VIEW: "payroll.view",
  PAYROLL_MANAGE: "payroll.manage",

  // Inventory
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_CREATE: "inventory.create",
  INVENTORY_EDIT: "inventory.edit",

  // Communication
  COMMUNICATION_VIEW: "communication.view",
  ANNOUNCEMENT_CREATE: "announcement.create",
  MESSAGE_SEND: "message.send",

  // School
  SCHOOL_VIEW: "school.view",
  SCHOOL_CREATE: "school.create",
  SCHOOL_EDIT: "school.edit",
  SCHOOL_DELETE: "school.delete",

  // Users & Roles
  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_EDIT: "user.edit",
  USER_DELETE: "user.delete",
  ROLE_MANAGE: "role.manage",

  // Reports
  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",

  // Settings
  SETTINGS_MANAGE: "settings.manage",

  // Super Admin
  ADMIN_ACCESS: "admin.access",
  AUDIT_VIEW: "audit.view",
  SUBSCRIPTION_MANAGE: "subscription.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

interface RoleDefinition {
  name: RoleName;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
}

const allPermissions = Object.values(PERMISSIONS);

const studentManager: Permission[] = [
  PERMISSIONS.STUDENT_VIEW,
  PERMISSIONS.STUDENT_CREATE,
  PERMISSIONS.STUDENT_EDIT,
  PERMISSIONS.STUDENT_DELETE,
];

const parentManager: Permission[] = [
  PERMISSIONS.PARENT_VIEW,
  PERMISSIONS.PARENT_CREATE,
  PERMISSIONS.PARENT_EDIT,
  PERMISSIONS.PARENT_DELETE,
];

const teacherManager: Permission[] = [
  PERMISSIONS.TEACHER_VIEW,
  PERMISSIONS.TEACHER_CREATE,
  PERMISSIONS.TEACHER_EDIT,
  PERMISSIONS.TEACHER_DELETE,
];

const academicManager: Permission[] = [
  PERMISSIONS.ACADEMICS_VIEW,
  PERMISSIONS.ACADEMICS_CREATE,
  PERMISSIONS.ACADEMICS_EDIT,
  PERMISSIONS.TIMETABLE_VIEW,
  PERMISSIONS.TIMETABLE_EDIT,
  PERMISSIONS.HOMEWORK_VIEW,
  PERMISSIONS.HOMEWORK_CREATE,
];

const PRINCIPAL_PERMISSIONS: Permission[] = [
  ...studentManager,
  ...academicManager,
  PERMISSIONS.EXAM_VIEW,
  PERMISSIONS.EXAM_CREATE,
  PERMISSIONS.EXAM_PUBLISH,
  PERMISSIONS.EXAM_RESULTS,
  PERMISSIONS.ATTENDANCE_VIEW,
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.REPORT_EXPORT,
  PERMISSIONS.SCHOOL_VIEW,
  PERMISSIONS.USER_VIEW,
];

const financialManager: Permission[] = [
  PERMISSIONS.FEES_VIEW,
  PERMISSIONS.FEES_MANAGE,
  PERMISSIONS.FEES_COLLECT,
  PERMISSIONS.FEES_REFUND,
  PERMISSIONS.FEES_REPORT,
];

export const ROLES: RoleDefinition[] = [
  {
    name: "SUPER_ADMIN",
    description: "Platform administrator with access to all schools",
    permissions: allPermissions,
    isSystem: true,
  },
  {
    name: "SCHOOL_ADMIN",
    description: "Administrator responsible for a single school",
    permissions: [
      ...allPermissions.filter((p) => p !== PERMISSIONS.ADMIN_ACCESS),
    ],
    isSystem: true,
  },
  {
    name: "BRANCH_ADMIN",
    description: "Administrator for a specific branch/campus",
    permissions: [
      ...studentManager,
      ...parentManager,
      ...teacherManager,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.ATTENDANCE_CREATE,
      PERMISSIONS.FEES_VIEW,
      PERMISSIONS.FEES_REPORT,
      PERMISSIONS.EXAM_VIEW,
      PERMISSIONS.EXAM_RESULTS,
      PERMISSIONS.ACADEMICS_VIEW,
      PERMISSIONS.TIMETABLE_VIEW,
      PERMISSIONS.HOMEWORK_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.SCHOOL_VIEW,
    ],
    isSystem: true,
  },
  {
    name: "PRINCIPAL",
    description: "Overall academic head of the school",
    permissions: PRINCIPAL_PERMISSIONS,
    isSystem: true,
  },
  {
    name: "VICE_PRINCIPAL",
    description: "Deputy academic head",
    permissions: [
      PERMISSIONS.STUDENT_VIEW,
      PERMISSIONS.TEACHER_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.ACADEMICS_VIEW,
      PERMISSIONS.EXAM_VIEW,
      PERMISSIONS.EXAM_RESULTS,
      PERMISSIONS.TIMETABLE_VIEW,
      PERMISSIONS.HOMEWORK_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.COMMUNICATION_VIEW,
    ],
    isSystem: true,
  },
  {
    name: "TEACHER",
    description: "Class teacher and subject teacher",
    permissions: [
      PERMISSIONS.STUDENT_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.ATTENDANCE_CREATE,
      PERMISSIONS.ATTENDANCE_EDIT,
      PERMISSIONS.EXAM_VIEW,
      PERMISSIONS.EXAM_RESULTS,
      PERMISSIONS.ACADEMICS_VIEW,
      PERMISSIONS.TIMETABLE_VIEW,
      PERMISSIONS.HOMEWORK_VIEW,
      PERMISSIONS.HOMEWORK_CREATE,
      PERMISSIONS.COMMUNICATION_VIEW,
      PERMISSIONS.MESSAGE_SEND,
    ],
    isSystem: true,
  },
  {
    name: "ACCOUNTANT",
    description: "Manages school finances",
    permissions: [
      ...financialManager,
      PERMISSIONS.FEES_REPORT,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_EXPORT,
    ],
    isSystem: true,
  },
  {
    name: "HR_MANAGER",
    description: "Manages human resources and payroll",
    permissions: [
      PERMISSIONS.HR_VIEW,
      PERMISSIONS.HR_CREATE,
      PERMISSIONS.HR_EDIT,
      PERMISSIONS.PAYROLL_VIEW,
      PERMISSIONS.PAYROLL_MANAGE,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.REPORT_VIEW,
    ],
    isSystem: true,
  },
  {
    name: "LIBRARIAN",
    description: "Manages the school library",
    permissions: [
      PERMISSIONS.LIBRARY_VIEW,
      PERMISSIONS.LIBRARY_ISSUE,
      PERMISSIONS.LIBRARY_RETURN,
      PERMISSIONS.STUDENT_VIEW,
    ],
    isSystem: true,
  },
  {
    name: "TRANSPORT_MANAGER",
    description: "Manages vehicles, routes, and drivers",
    permissions: [
      PERMISSIONS.TRANSPORT_VIEW,
      PERMISSIONS.TRANSPORT_EDIT,
      PERMISSIONS.STUDENT_VIEW,
    ],
    isSystem: true,
  },
  {
    name: "RECEPTIONIST",
    description: "Front desk operator",
    permissions: [
      PERMISSIONS.STUDENT_VIEW,
      PERMISSIONS.STUDENT_CREATE,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.COMMUNICATION_VIEW,
    ],
    isSystem: true,
  },
  {
    name: "STAFF",
    description: "General school staff",
    permissions: [PERMISSIONS.STUDENT_VIEW, PERMISSIONS.COMMUNICATION_VIEW],
    isSystem: true,
  },
  {
    name: "STUDENT",
    description: "Student account",
    permissions: [
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.EXAM_VIEW,
      PERMISSIONS.EXAM_RESULTS,
      PERMISSIONS.HOMEWORK_VIEW,
      PERMISSIONS.FEES_VIEW,
      PERMISSIONS.TIMETABLE_VIEW,
      PERMISSIONS.COMMUNICATION_VIEW,
    ],
    isSystem: true,
  },
  {
    name: "PARENT",
    description: "Parent or guardian account",
    permissions: [
      PERMISSIONS.STUDENT_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.EXAM_VIEW,
      PERMISSIONS.EXAM_RESULTS,
      PERMISSIONS.HOMEWORK_VIEW,
      PERMISSIONS.FEES_VIEW,
      PERMISSIONS.TIMETABLE_VIEW,
      PERMISSIONS.COMMUNICATION_VIEW,
      PERMISSIONS.MESSAGE_SEND,
      PERMISSIONS.TRANSPORT_VIEW,
    ],
    isSystem: true,
  },
];

export const getRolePermissions = (roleName: string): Permission[] => {
  const role = ROLES.find((r) => r.name === roleName);
  return role?.permissions || [];
};