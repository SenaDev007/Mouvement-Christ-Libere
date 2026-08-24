"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <>
      {/* Overlay de transition */}
      <motion.div
        initial={false}
        animate={{
          scaleY: isLoading ? [0, 1, 1, 0] : 0,
          transformOrigin: isLoading ? "top" : "bottom",
        }}
        transition={{
          duration: 0.6,
          times: [0, 0.4, 0.6, 1],
          ease: "easeInOut",
        }}
        className="fixed inset-0 z-[9998] bg-imperial pointer-events-none"
        style={{ transformOrigin: "top" }}
      >
        <div className="h-full w-full flex items-center justify-center">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="w-2 h-16 bg-gradient-to-b from-gold via-gold-light to-gold"
          />
        </div>
      </motion.div>

      {/* Contenu */}
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        {children}
      </motion.div>
    </>
  );
}
