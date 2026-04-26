import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    screens: {
      sm: "640px",
      md: "980px",
      lg: "1280px",
      xl: "1440px",
    },
    extend: {
      colors: {
        orange: {
          DEFAULT: "#E8710A",
          deep: "#C45F08",
          soft: "#FCE9D6",
        },
        navy: {
          DEFAULT: "#1B2838",
          soft: "#2A3B50",
        },
        blue: { DEFAULT: "#2D9CDB" },
        green: {
          DEFAULT: "#27AE60",
          soft: "#DDF1E5",
        },
        red: {
          DEFAULT: "#EB5757",
          soft: "#FBE0E0",
        },
        beige: {
          DEFAULT: "#F5F0EB",
          deep: "#ECE4D9",
        },
        paper: "#FAF6F0",
        line: {
          DEFAULT: "#D9CFC1",
          soft: "#E5DCCD",
        },
        ink: {
          DEFAULT: "#1B2838",
          mute: "#5C6B7E",
          faint: "#8A95A4",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo"],
      },
      letterSpacing: {
        tightest: "-0.03em",
        tighter: "-0.02em",
      },
      maxWidth: {
        page: "1280px",
      },
      keyframes: {
        pulse: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        blink: {
          "0%,50%": { opacity: "1" },
          "51%,100%": { opacity: "0" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        pulse: "pulse 1.6s ease-in-out infinite",
        blink: "blink 1s step-end infinite",
        spin: "spin 0.7s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
