import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf8",
          100: "#d5f5ee",
          200: "#aeeadf",
          300: "#79d7cb",
          400: "#44bdb3",
          500: "#2aa29a",
          600: "#1f827d",
          700: "#1c6865",
          800: "#1b5351",
          900: "#1a4544",
          950: "#092928",
        },
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5dae3",
          300: "#b0b9c9",
          400: "#8593ab",
          500: "#667690",
          600: "#515e76",
          700: "#434d60",
          800: "#3a4251",
          900: "#343946",
          950: "#22262f",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f4f7fb",
          soft: "#eef2f7",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(34, 38, 47, 0.04), 0 8px 24px rgba(34, 38, 47, 0.06)",
        float: "0 12px 40px rgba(34, 38, 47, 0.12)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
