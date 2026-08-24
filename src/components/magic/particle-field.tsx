"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface ParticleFieldProps {
  count?: number;
  className?: string;
  color?: string;
  size?: number;
  speed?: "slow" | "medium" | "fast";
}

const SPEED_DURATION = {
  slow: { min: 15, max: 30 },
  medium: { min: 8, max: 18 },
  fast: { min: 4, max: 10 },
};

interface Particle {
  id: number;
  x: number; // %
  y: number; // %
  size: number;
  duration: number;
  delay: number;
  drift: number;
}

export function ParticleField({
  count = 30,
  className,
  color = "#C9A227",
  size = 2,
  speed = "medium",
}: ParticleFieldProps) {
  const particles = useMemo<Particle[]>(() => {
    const speeds = SPEED_DURATION[speed];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: size + Math.random() * size * 1.5,
      duration: speeds.min + Math.random() * (speeds.max - speeds.min),
      delay: Math.random() * 10,
      drift: (Math.random() - 0.5) * 50,
    }));
  }, [count, size, speed]);

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: color,
            boxShadow: `0 0 ${p.size * 3}px ${color}`,
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, p.drift, 0],
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
