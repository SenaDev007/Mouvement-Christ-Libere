"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AuroraBackgroundProps {
  className?: string;
  variant?: "imperial" | "gold" | "lavender" | "dawn";
  intensity?: "subtle" | "medium" | "strong";
  children?: React.ReactNode;
}

const VARIANT_COLORS = {
  imperial: ["#2A0E3D", "#3D1A54", "#1A0826"],
  gold: ["#C9A227", "#DDBE55", "#A3821C"],
  lavender: ["#8C5FA8", "#A878C4", "#6B4485"],
  dawn: ["#2A0E3D", "#8C5FA8", "#C9A227"],
};

const INTENSITY_OPACITY = {
  subtle: 0.15,
  medium: 0.3,
  strong: 0.5,
};

export function AuroraBackground({
  className,
  variant = "imperial",
  intensity = "medium",
  children,
}: AuroraBackgroundProps) {
  const colors = VARIANT_COLORS[variant];
  const opacity = INTENSITY_OPACITY[intensity];

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0" style={{ backgroundColor: colors[0] }} />

      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      >
        <motion.div
          className="absolute -top-1/4 -left-1/4 w-[80vw] h-[80vw] rounded-full blur-[120px]"
          style={{ backgroundColor: colors[1], opacity }}
          animate={{
            x: [0, 100, 0],
            y: [0, 80, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute -bottom-1/4 -right-1/4 w-[70vw] h-[70vw] rounded-full blur-[100px]"
          style={{ backgroundColor: colors[2], opacity: opacity * 0.8 }}
          animate={{
            x: [0, -120, 0],
            y: [0, -60, 0],
            scale: [1.1, 1, 1.1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute top-1/2 left-1/2 w-[50vw] h-[50vw] rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2"
          style={{ backgroundColor: colors[1], opacity: opacity * 0.4 }}
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, 90, 0],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Grain noise */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)",
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
