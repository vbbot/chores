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
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        border: "var(--border)",
        secondary: "var(--secondary)",
        destructive: "var(--destructive)",
        success: "var(--success)",
      },
      borderRadius: {
        card: "6px",
        btn: "8px",
      },
      borderWidth: {
        DEFAULT: "1px",
        heavy: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
