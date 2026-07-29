import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#03004b",
        "primary-container": "#1b1c5e",
        secondary: "#7b5814",
        "secondary-fixed": "#ffdeab",
        "secondary-container": "#fdcd7e",
        surface: "#fbf8ff",
        "surface-low": "#f4f2ff",
        "surface-variant": "#e2e1f0",
        "surface-container": "#eeecfc",
        "on-background": "#1a1b25",
        outline: "#777681",
        "outline-variant": "#c7c5d2",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
      },
      fontFamily: {
        doran: ["Doran", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
