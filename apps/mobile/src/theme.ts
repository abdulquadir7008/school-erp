export const theme = {
  colors: {
    primary: "#1a7a1a",
    primaryDark: "#124f12",
    accent: "#3366ff",
    background: "#f6f8f6",
    card: "#ffffff",
    text: "#0f172a",
    muted: "#64748b",
    border: "#e2e8f0",
    success: "#16a34a",
    warning: "#d97706",
    danger: "#dc2626",
  },
  radius: 16,
} as const;

export type RoleName = "STUDENT" | "TEACHER";
