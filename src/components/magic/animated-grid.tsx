"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedGridProps {
  className?: string;
  cellSize?: number;
  color?: string;
  fade?: boolean;
}

export function AnimatedGrid({
  className,
  cellSize = 60,
  color = "rgba(201, 162, 39, 0.08)",
  fade = true,
}: AnimatedGridProps) {
  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}>
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${color} 1px, transparent 1px),
            linear-gradient(to bottom, ${color} 1px, transparent 1px)
          `,
          backgroundSize: `${cellSize}px ${cellSize}px`,
        }}
        animate={{
          backgroundPosition: ["0px 0px", `${cellSize}px ${cellSize}px`],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Fade mask */}
      {fade && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 0%, transparent 30%, rgba(0,0,0,0.5) 100%)",
          }}
        />
      )}
    </div>
  );
}
