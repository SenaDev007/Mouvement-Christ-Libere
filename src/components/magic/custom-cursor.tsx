"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export function CustomCursor() {
  const [isVisible, setIsVisible] = useState(false);
  const [isPointer, setIsPointer] = useState(false);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  const springConfig = { damping: 25, stiffness: 700 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    // Désactiver sur mobile/touch
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX - 16);
      cursorY.set(e.clientY - 16);
      setIsVisible(true);

      const target = e.target as HTMLElement;
      const isClickable =
        target.closest("a, button, input, textarea, select, [role='button']") !== null;
      setIsPointer(isClickable);
    };

    const hideCursor = () => setIsVisible(false);

    window.addEventListener("mousemove", moveCursor);
    document.addEventListener("mouseleave", hideCursor);

    return () => {
      window.removeEventListener("mousemove", moveCursor);
      document.removeEventListener("mouseleave", hideCursor);
    };
  }, [cursorX, cursorY]);

  if (!isVisible) return null;

  return (
    <>
      {/* Halo doré qui suit la souris */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9999] hidden md:block"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
        }}
      >
        <motion.div
          animate={{
            scale: isPointer ? 1.5 : 1,
            opacity: isPointer ? 0.6 : 0.3,
          }}
          transition={{ duration: 0.2 }}
          className="w-8 h-8 rounded-full border border-gold"
          style={{
            backgroundColor: "rgba(201, 162, 39, 0.1)",
            backdropFilter: "blur(2px)",
          }}
        />
      </motion.div>

      {/* Point central */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9999] hidden md:block"
        style={{
          x: cursorX,
          y: cursorY,
        }}
      >
        <motion.div
          animate={{
            scale: isPointer ? 0 : 1,
          }}
          transition={{ duration: 0.2 }}
          className="w-2 h-2 ml-[15px] mt-[15px] rounded-full bg-gold"
        />
      </motion.div>
    </>
  );
}
