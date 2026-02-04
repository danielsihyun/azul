import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        azul: {
          blue: "#1a6fb0",
          yellow: "#e8a838",
          red: "#c43a3a",
          black: "#2d2d2d",
          cyan: "#3ab8b0",
          bg: "#0c1a2e",
          panel: "#132240",
          surface: "#1a2d4d",
          gold: "#c9a84c",
          accent: "#4a9eff",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
        body: ['"DM Sans"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
