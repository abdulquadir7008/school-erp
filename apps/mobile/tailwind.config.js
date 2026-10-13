/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef7ee",
          100: "#d7ecd7",
          200: "#b0d9b0",
          300: "#7fc07f",
          400: "#4da64d",
          500: "#2b8a2b",
          600: "#1a7a1a",
          700: "#156315",
          800: "#124f12",
          900: "#0f4210",
        },
        accent: {
          400: "#5c85ff",
          500: "#3366ff",
          600: "#254fd1",
        },
        sidebar: "#0f172a",
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};
