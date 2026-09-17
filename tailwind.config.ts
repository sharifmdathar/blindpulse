import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Night sky surfaces — the "new moon" backdrop
        night: {
          950: "#07070d",
          900: "#0b0b15",
          800: "#10101c",
          700: "#181828",
          600: "#222236",
        },
        // Moonlight accents — silver text, violet glow
        moon: {
          50: "#f4f2fb",
          100: "#e9e5f6",
          200: "#d4cdf0",
          300: "#b4abe4",
          400: "#9186d6",
          500: "#7c6bce",
          600: "#6a58c2",
          DEFAULT: "#e9e5f6",
        },
        glow: "#8b7cff",
      },
      boxShadow: {
        // Soft moonrise halo used on primary cards/buttons
        glow: "0 0 24px rgba(139, 124, 255, 0.25)",
        "glow-sm": "0 0 12px rgba(139, 124, 255, 0.2)",
      },
      backgroundImage: {
        // Hero gradient headline: silver → violet moonlight
        "moon-text":
          "linear-gradient(135deg, #f4f2fb 0%, #d4cdf0 45%, #9186d6 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
