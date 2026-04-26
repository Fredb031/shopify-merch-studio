import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        lora: ['Lora', 'serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        navy: {
          DEFAULT: "hsl(var(--navy))",
          light: "hsl(var(--navy2))",
          dark: "hsl(var(--navydark))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          light: "hsl(var(--gold2))",
        },
        green: "hsl(var(--green))",
        brand: {
          black: '#0A0A0A',
          white: '#FFFFFF',
          blue: '#0052CC',
          'blue-hover': '#003D99',
          'blue-light': '#EBF2FF',
          dark: '#111827',
          grey: '#6B7280',
          'grey-strong': '#374151',
          'grey-light': '#F9FAFB',
          'grey-border': '#E5E7EB',
          'grey-mid': '#D1D5DB',
          success: '#059669',
          error: '#DC2626',
          warning: '#D97706',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        // Kept: live animations still referenced in src/.
        starburst: { "0%": { opacity: "1", transform: "scale(0.4) translate(-50%,-50%)" }, "100%": { opacity: "0", transform: "scale(2) translate(-50%,-130%)" } },
        staggerUp: { to: { opacity: "1", transform: "translateY(0)" } },
        heroLogoScroll: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        marqueeScroll: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: {
        starburst: "starburst 0.6s ease forwards",
        "stagger-up": "staggerUp 0.7s cubic-bezier(.16,1,.3,1) forwards",
        "hero-logo-scroll": "heroLogoScroll 24s linear infinite",
        "marquee-scroll": "marqueeScroll 28s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
