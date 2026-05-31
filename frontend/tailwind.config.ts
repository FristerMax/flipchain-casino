import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        casino: {
          // Legacy tokens kept for backward-compat
          black: "#0f1218",
          "dark-purple": "#1a0a2e",
          purple: "#2d1654",
          "light-purple": "#4a2080",
          gold: "#f0b90b",
          "gold-dim": "#c49a12",
          "gold-bright": "#ffe066",
          emerald: "#00c74d",
          "emerald-dim": "#00a86b",
          "card-bg": "#1a2035",
          "border-subtle": "rgba(255,255,255,0.07)",
          // New Stake.com-inspired tokens
          "bg-primary": "#0f1218",
          "bg-card": "#1a2035",
          "bg-card-2": "#1e2640",
          "accent-green": "#00c74d",
          "accent-gold": "#f0b90b",
          "accent-red": "#f6465d",
          "text-primary": "#eaecef",
          "text-secondary": "rgba(255,255,255,0.45)",
        },
      },
      fontFamily: {
        display: ["'Cinzel'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
      animation: {
        "coin-flip": "coinFlip 1.5s ease-in-out forwards",
        "coin-idle": "coinIdle 3s ease-in-out infinite",
        "pulse-gold": "pulseGold 2s ease-in-out infinite",
        "pulse-green": "pulseGreen 2s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
        "shimmer-load": "shimmerLoad 1.5s ease-in-out infinite",
        "win-bounce": "winBounce 0.6s ease-out",
        "lose-shake": "loseShake 0.5s ease-in-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
      keyframes: {
        coinFlip: {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(1800deg)" },
        },
        coinIdle: {
          "0%, 100%": { transform: "rotateY(0deg) translateY(0px)" },
          "50%": { transform: "rotateY(20deg) translateY(-6px)" },
        },
        pulseGold: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(240, 185, 11, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(240, 185, 11, 0.7)" },
        },
        pulseGreen: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 199, 77, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(0, 199, 77, 0.7)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        shimmerLoad: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        winBounce: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.08)" },
          "70%": { transform: "scale(0.97)" },
          "100%": { transform: "scale(1)" },
        },
        loseShake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-8px)" },
          "40%": { transform: "translateX(8px)" },
          "60%": { transform: "translateX(-6px)" },
          "80%": { transform: "translateX(6px)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      backgroundImage: {
        "stake-radial":
          "radial-gradient(ellipse at 50% 0%, rgba(0,199,77,0.06) 0%, transparent 60%)",
        "gold-gradient": "linear-gradient(135deg, #f0b90b 0%, #c49a12 100%)",
        "green-gradient": "linear-gradient(135deg, #00c74d 0%, #009e3d 100%)",
        "card-gradient": "linear-gradient(145deg, #1a2035 0%, #151c2e 100%)",
      },
      boxShadow: {
        gold: "0 0 30px rgba(240, 185, 11, 0.4)",
        "gold-sm": "0 0 12px rgba(240, 185, 11, 0.25)",
        green: "0 0 30px rgba(0, 199, 77, 0.4)",
        "green-sm": "0 0 12px rgba(0, 199, 77, 0.2)",
        card: "0 4px 32px rgba(0, 0, 0, 0.5)",
        "inset-border": "inset 0 0 0 1px rgba(255,255,255,0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
