import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef7ee",
          100: "#d4edd4",
          200: "#a8daa8",
          300: "#6fc06f",
          400: "#3da13d",
          500: "#1a7a1a",
          600: "#156215",
          700: "#114d11",
          800: "#0d3d0d",
          900: "#092d09",
        },
        accent: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd4ff",
          300: "#8eb8ff",
          400: "#598eff",
          500: "#3366ff",
          600: "#1a44f5",
          700: "#1332e1",
          800: "#162ab6",
          900: "#18298f",
        },
        sidebar: {
          DEFAULT: "#0f172a",
          foreground: "#e2e8f0",
          accent: "#1e293b",
        },
        muted: {
          DEFAULT: "#f1f5f9",
          foreground: "#64748b",
        },
        border: "#e2e8f0",
        input: "#e2e8f0",
        ring: "#1a7a1a",
        background: "#ffffff",
        foreground: "#0f172a",
        card: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-in": "slideIn 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
