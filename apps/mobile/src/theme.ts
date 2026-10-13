export const theme = {
  colors: {
    // Brand — modern indigo (shared identity)
    brand: {
      50: "#EEF2FF",
      100: "#E0E7FF",
      200: "#C7D2FE",
      300: "#A5B4FC",
      400: "#818CF8",
      500: "#6366F1",
      600: "#4F46E5",
      700: "#4338CA",
      800: "#3730A3",
      900: "#312E81",
    },
    // Role accents
    student: {
      primary: "#4F46E5",
      deep: "#1E1B4B",
      accent: "#F59E0B",
      soft: "#EEF2FF",
    },
    teacher: {
      primary: "#0D9488",
      deep: "#042F2E",
      accent: "#F59E0B",
      soft: "#ECFDF5",
    },
    canvas: "#F4F5FB",
    card: "#FFFFFF",
    ink: "#0F172A",
    muted: "#64748B",
    faint: "#94A3B8",
    border: "#E6E8F0",
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
  },
  radius: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 28,
  },
} as const;

export type RoleName = "STUDENT" | "TEACHER";

export const roleTheme = (role: RoleName | null | undefined) =>
  role === "TEACHER" ? theme.colors.teacher : theme.colors.student;
