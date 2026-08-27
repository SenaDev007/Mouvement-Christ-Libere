"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export function PageLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8 } }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#1A0826]"
        >
          {/* Image de fond : les deux serviteurs */}
          <div className="absolute inset-0 z-0">
            <img
              src="/pam-kongo-hero.webp"
              alt=""
              className="w-full h-full opacity-20"
              style={{ objectFit: "cover", objectPosition: "center center" }}
            />
            <div className="absolute inset-0 bg-[#1A0826]/70" />
          </div>

          {/* Logo pulsatif */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative z-10"
          >
            {/* Halo doré derrière le logo */}
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute -inset-4 rounded-full bg-[#C9A227]/20 blur-2xl"
            />
            <Image
              src="/logo-christ-libere.png"
              alt="Christ Libère"
              width={80}
              height={80}
              className="relative w-16 h-16 md:w-20 md:h-20 object-contain"
              priority
            />
          </motion.div>

          {/* Texte "Christ Libère" + barre de progression 5s */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="absolute bottom-1/4 z-10 text-center"
          >
            <p className="text-lg font-bold mb-3">
              <span style={{ color: "#C9A227" }}>Christ</span>
              <span style={{ color: "#FAF6EF" }}>&nbsp;Libère</span>
            </p>
            {/* Barre de progression qui se remplit en 5 secondes */}
            <div className="w-48 h-1 bg-[#FAF6EF]/10 rounded-full overflow-hidden mx-auto">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 5, ease: "easeInOut" }}
                className="h-full bg-[#C9A227] rounded-full"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
