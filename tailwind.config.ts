import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#10202a",
        muted: "#5c6b74",
        line: "#d9e4e9",
        aqua: "#0f9f9c",
        navy: "#12304a",
        soft: "#f4f8fa",
        warn: "#b45309",
        danger: "#b91c1c"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(16, 32, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
