"use client";

import { useRef, useState, ReactNode } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface MagneticButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  strength?: number;
}

export function MagneticButton({
  children,
  href,
  onClick,
  variant = "primary",
  className,
  strength = 0.4,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setPosition({ x: x * strength, y: y * strength });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const baseClass = cn(
    "group relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-md font-semibold text-sm transition-colors overflow-hidden whitespace-nowrap",
    variant === "primary" && "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55]",
    variant === "secondary" && "border border-[#C9A227]/40 text-[#C9A227] hover:bg-[#C9A227]/10",
    variant === "ghost" && "text-[#FAF6EF]/80 hover:text-[#C9A227]",
    className
  );

  const content = (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="inline-block"
    >
      {href ? (
        <Link href={href} className={cn(baseClass, "block")}>
          {/* Halo lumineux animé */}
          {variant === "primary" && (
            <span className="absolute inset-0 bg-gradient-to-r from-[#DDBE55] via-[#C9A227] to-[#DDBE55] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          )}
          {/* Shine effect */}
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <span className="relative z-10 flex items-center gap-2">{children}</span>
        </Link>
      ) : (
        <button onClick={onClick} className={cn(baseClass, "block")}>
          {variant === "primary" && (
            <span className="absolute inset-0 bg-gradient-to-r from-[#DDBE55] via-[#C9A227] to-[#DDBE55] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          )}
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <span className="relative z-10 flex items-center gap-2">{children}</span>
        </button>
      )}
    </motion.div>
  );

  return content;
}
