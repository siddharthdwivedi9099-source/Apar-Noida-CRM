import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1440px"
      }
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        }
      },
      borderRadius: {
        xl: "var(--radius)",
        lg: "calc(var(--radius) - 2px)",
        md: "calc(var(--radius) - 6px)"
      },
      fontFamily: {
        sans: ["\"Avenir Next\"", "\"Segoe UI\"", "system-ui", "sans-serif"],
        display: ["\"Space Grotesk\"", "\"Avenir Next\"", "system-ui", "sans-serif"]
      },
      boxShadow: {
        panel: "0 24px 70px -34px rgb(15 23 42 / 0.35)"
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(249, 115, 22, 0.16), transparent 32%), radial-gradient(circle at bottom right, rgba(14, 116, 144, 0.14), transparent 28%)"
      }
    }
  },
  plugins: [animate]
};

export default config;
